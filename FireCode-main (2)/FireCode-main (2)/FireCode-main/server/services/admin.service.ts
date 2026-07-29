import { ProblemRepository } from "../repositories/problem.repository";
import { TestCaseRepository } from "../repositories/testcase.repository";
import { UserRepository } from "../repositories/user.repository";
import { SubmissionRepository } from "../repositories/submission.repository";
import { ContestRepository } from "../repositories/contest.repository";
import PointsTransaction from "../models/points-transaction.model";
import AuditLog from "../models/audit.model";
import ProblemModel from "../models/problem.model";
import TestCaseModel from "../models/testcase.model";
import SubmissionModel from "../models/submission.model";
import UserModel from "../models/user.model";
import ContestModel from "../models/contest.model";
import { NotFoundError, BadRequestError, ConflictError } from "../errors/AppError";
import AdmZip from "adm-zip";
import mongoose from "mongoose";
import cacheService from "./cache.service";

import { runOfficialSolutionOnInput } from "../utils/createTest";

export class AdminService {
    static async generateOutputsBatch(payload: {
        code: string;
        language: string;
        testcases: Array<{ id: string; input: string }>;
        batchSize?: number;
    }) {
        const { code, language, testcases, batchSize = 15 } = payload;

        if (!code || !language || !Array.isArray(testcases)) {
            throw new BadRequestError("Missing code, language, or testcases array.");
        }

        const startTime = Date.now();
        const results: Array<{ id: string; expectedOutput: string; status: "success" | "failed"; error?: string; runtime?: number; generatedTime: string }> = [];

        // Process in concurrent chunks of batchSize (10-20 Judge0 requests in parallel)
        for (let i = 0; i < testcases.length; i += batchSize) {
            const chunk = testcases.slice(i, i + batchSize);
            const chunkPromises = chunk.map(async (tc) => {
                const res = await runOfficialSolutionOnInput(code, language, tc.input);
                const timestamp = new Date().toLocaleTimeString();
                if (res.success) {
                    return {
                        id: tc.id,
                        expectedOutput: res.output,
                        status: "success" as const,
                        runtime: res.runtime,
                        generatedTime: timestamp,
                    };
                } else {
                    return {
                        id: tc.id,
                        expectedOutput: "",
                        status: "failed" as const,
                        error: res.error || "Execution failed",
                        generatedTime: timestamp,
                    };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }

        const totalTimeTakenSec = Math.round((Date.now() - startTime) / 1000);
        const successCount = results.filter((r) => r.status === "success").length;
        const failedCount = results.filter((r) => r.status === "failed").length;

        return {
            summary: {
                total: testcases.length,
                successCount,
                failedCount,
                timeTakenSec: totalTimeTakenSec,
            },
            results,
        };
    }

    static async getProblems() {
        return ProblemRepository.getAll({ isDeleted: false }, null, { problemId: 1 });
    }

    static async getProblemById(id: string) {
        const problem = await ProblemRepository.findById(id);
        if (!problem) {
            throw new NotFoundError("Problem not found.");
        }
        return problem;
    }

    static async createProblem(problemData: any, dbUser: any, ip: string) {
        const { problemId, title, slug, testcases } = problemData;

        const existing = await ProblemRepository.findByIdOrSlug(problemId, slug);
        if (existing) {
            throw new ConflictError("Problem ID or Slug already exists.");
        }

        const problem = await ProblemRepository.create({
            ...problemData,
            createdBy: dbUser._id,
            updatedBy: dbUser._id
        });

        if (testcases && Array.isArray(testcases) && testcases.length > 0) {
            const testCasesToInsert = testcases.map((tc: any, idx: number) => ({
                problemId: problem._id.toString(),
                input: tc.input || "",
                expectedOutput: tc.expectedOutput || tc.output || "",
                explanation: tc.explanation || "",
                executionOrder: tc.executionOrder ?? idx,
                weight: tc.weight ?? 1,
                isHidden: tc.isHidden ?? false,
                isDeleted: false
            }));
            await TestCaseRepository.insertMany(testCasesToInsert);
        }

        // Invalidate caching
        await cacheService.del("problems:global");
        await cacheService.del("admin:dashboard:stats");

        await AuditLog.create({
            action: "CREATE_PROBLEM",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Created problem: "${title}" (ID: ${problemId})`,
            ipAddress: ip
        });

        return problem;
    }

    static async updateProblem(id: string, problemData: any, dbUser: any, ip: string) {
        const existing = await ProblemRepository.findById(id);
        if (!existing) {
            throw new NotFoundError("Problem not found.");
        }

        const oldSlug = existing.slug;
        const newSlug = problemData.slug;

        const updated = await ProblemRepository.update(id, {
            ...problemData,
            updatedBy: dbUser._id
        });

        // Invalidate caching
        await cacheService.del("problems:global");
        await cacheService.del(`problem:${oldSlug}`);
        await cacheService.del(`problem:${newSlug}`);
        await cacheService.del("admin:dashboard:stats");

        if (updated && oldSlug !== newSlug) {
            // Update all submissions using the old slug to reference the new slug
            await SubmissionModel.updateMany({ problemSlug: oldSlug }, { $set: { problemSlug: newSlug } });

            // Update all users who solved this problem slug
            await UserModel.updateMany({ problems_solved: oldSlug }, { $set: { "problems_solved.$": newSlug } });

            // Update all users who attempted this problem slug
            await UserModel.updateMany({ problems_attempted: oldSlug }, { $set: { "problems_attempted.$": newSlug } });
        }

        await AuditLog.create({
            action: "UPDATE_PROBLEM",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated problem: "${updated?.title}" (ID: ${updated?.problemId})`,
            ipAddress: ip
        });

        return updated;
    }

    static async deleteProblem(id: string, dbUser: any, ip: string) {
        const problem = await ProblemRepository.update(id, { isDeleted: true });
        if (!problem) {
            throw new NotFoundError("Problem not found.");
        }

        // Invalidate caching
        await cacheService.del("problems:global");
        await cacheService.del(`problem:${problem.slug}`);
        await cacheService.del("admin:dashboard:stats");

        await AuditLog.create({
            action: "DELETE_PROBLEM",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Soft deleted problem: "${problem.title}" (ID: ${problem.problemId})`,
            ipAddress: ip
        });

        return problem;
    }

    static async duplicateProblem(id: string, dbUser: any, ip: string) {
        const orig = await ProblemRepository.findById(id);
        if (!orig) {
            throw new NotFoundError("Problem not found.");
        }

        const maxIdProb = await ProblemModel.findOne().sort({ problemId: -1 });
        const nextId = (maxIdProb?.problemId || 0) + 1;
        const newSlug = `${orig.slug}-dup-${nextId}`;

        const duplicated = new ProblemModel({
            ...(orig.toObject() as any),
            _id: undefined,
            problemId: nextId,
            title: `${orig.title} (Copy)`,
            slug: newSlug,
            status: "draft",
            submissionCount: 0,
            successCount: 0,
            acceptanceRate: 0,
            createdBy: dbUser._id,
            updatedBy: dbUser._id,
            createdAt: undefined,
            updatedAt: undefined
        });

        await duplicated.save();

        // Invalidate caching
        await cacheService.del("problems:global");
        await cacheService.del("admin:dashboard:stats");

        const origTestCases = await TestCaseRepository.findByProblemId(orig._id.toString(), { isDeleted: false });
        if (origTestCases.length) {
            const dupTestCases = origTestCases.map(tc => ({
                ...tc.toObject(),
                _id: undefined,
                problemId: duplicated._id,
                createdAt: undefined,
                updatedAt: undefined
            }));
            await TestCaseRepository.insertMany(dupTestCases);
        }

        await AuditLog.create({
            action: "DUPLICATE_PROBLEM",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Duplicated problem ID ${orig.problemId} into ID ${nextId}`,
            ipAddress: ip
        });

        return duplicated;
    }

    static async getTestCases(problemId: string) {
        return TestCaseRepository.findByProblemId(problemId, { isDeleted: false });
    }

    static async updateTestCases(problemId: string, testcases: any[], dbUser: any, ip: string) {
        await TestCaseRepository.softDeleteByProblemId(problemId);

        const testCasesToInsert = testcases.map((tc, idx) => ({
            problemId,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            explanation: tc.explanation,
            executionOrder: tc.executionOrder ?? idx,
            weight: tc.weight ?? 1,
            timeLimit: tc.timeLimit,
            memoryLimit: tc.memoryLimit,
            isHidden: tc.isHidden ?? false,
            isDeleted: false
        }));

        await TestCaseRepository.insertMany(testCasesToInsert);

        await AuditLog.create({
            action: "UPDATE_TESTCASES",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated test cases for problem ID ${problemId}`,
            ipAddress: ip
        });
    }

    static async bulkDelete(ids: string[], dbUser: any, ip: string) {
        await ProblemRepository.updateMany({ _id: { $in: ids } }, { $set: { isDeleted: true } });

        // Invalidate problem list cache so deleted problems stop appearing immediately
        await cacheService.del("problems:global");
        await cacheService.del("admin:dashboard:stats");

        await AuditLog.create({
            action: "BULK_DELETE",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Bulk deleted problems: [${ids.join(", ")}]`,
            ipAddress: ip
        });
    }

    static async bulkPublish(ids: string[], status: string, dbUser: any, ip: string) {
        await ProblemRepository.updateMany({ _id: { $in: ids } }, { $set: { status } });

        // Invalidate problem list cache so published changes are immediately visible
        await cacheService.del("problems:global");
        await cacheService.del("admin:dashboard:stats");

        await AuditLog.create({
            action: "BULK_PUBLISH",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Bulk status update to "${status}" for: [${ids.join(", ")}]`,
            ipAddress: ip
        });
    }

    static async bulkDifficulty(ids: string[], difficulty: string, dbUser: any, ip: string) {
        await ProblemRepository.updateMany({ _id: { $in: ids } }, { $set: { difficulty } });

        // Invalidate problem list cache so difficulty changes are immediately visible
        await cacheService.del("problems:global");

        await AuditLog.create({
            action: "BULK_DIFFICULTY",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Bulk difficulty updated to "${difficulty}" for: [${ids.join(", ")}]`,
            ipAddress: ip
        });
    }

    static async bulkTags(ids: string[], tags: string[], operation: "add" | "remove", dbUser: any, ip: string) {
        const updateQuery = operation === "add"
            ? { $addToSet: { tags: { $each: tags } } }
            : { $pull: { tags: { $in: tags } } };

        await ProblemRepository.updateMany({ _id: { $in: ids } }, updateQuery);

        // Invalidate problem list cache so tag changes are immediately visible
        await cacheService.del("problems:global");

        await AuditLog.create({
            action: "BULK_TAGS",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Bulk tags update (${operation}) for: [${ids.join(", ")}]`,
            ipAddress: ip
        });
    }

    static async importProblems(importData: { format: string; payload: any }, dbUser: any, ip: string) {
        const { format, payload } = importData;
        let problemsToImport: any[] = [];

        if (format === "json") {
            const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
            problemsToImport = Array.isArray(parsed) ? parsed : [parsed];
        } else if (format === "csv") {
            const splitCsvRow = (line: string): string[] => {
                const result: string[] = [];
                let current = "";
                let inQuotes = false;
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = "";
                    } else {
                        current += char;
                    }
                }
                result.push(current.trim());
                return result.map(v => v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).trim() : v);
            };

            const lines = payload.trim().split("\n");
            const headers = splitCsvRow(lines[0]);
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i]) continue;
                const values = splitCsvRow(lines[i]);
                const prob: any = {};
                headers.forEach((h: string, idx: number) => {
                    const key = h.trim();
                    let val: any = values[idx]?.trim();
                    if (key === "problemId" || key === "timeLimit" || key === "memoryLimit" || key === "points") {
                        val = Number(val);
                    } else if (key === "tags" || key === "hints") {
                        val = val ? val.split(";") : [];
                    }
                    prob[key] = val;
                });
                problemsToImport.push(prob);
            }
        } else if (format === "txt") {
            const lines = payload.trim().split("\n");
            for (const line of lines) {
                if (!line) continue;
                const parts = line.split("|");
                if (parts.length >= 4) {
                    problemsToImport.push({
                        title: parts[0].trim(),
                        slug: parts[1].trim(),
                        difficulty: parts[2].trim(),
                        description: parts[3].trim(),
                        problemId: Math.floor(Math.random() * 100000)
                    });
                }
            }
        } else if (format === "zip") {
            const buffer = Buffer.from(payload, "base64");
            const zip = new AdmZip(buffer);
            const problemsEntry = zip.getEntry("problems.json");
            if (problemsEntry) {
                const txt = problemsEntry.getData().toString("utf8");
                problemsToImport = JSON.parse(txt);
            } else {
                throw new BadRequestError("problems.json not found in ZIP.");
            }
        } else {
            throw new BadRequestError("Unsupported import format.");
        }

        let importCount = 0;
        for (const item of problemsToImport) {
            if (!item.title || !item.slug || !item.difficulty) continue;

            const existing = await ProblemRepository.findByIdOrSlug(item.problemId, item.slug);
            if (existing) continue;

            await ProblemRepository.create({
                ...item,
                createdBy: dbUser._id,
                updatedBy: dbUser._id
            });
            importCount++;
        }

        await AuditLog.create({
            action: "IMPORT_PROBLEMS",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Imported ${importCount} problems via format: ${format}`,
            ipAddress: ip
        });

        return `Successfully imported ${importCount} problems.`;
    }

    static async getExportData(format: string) {
        const problems = await ProblemRepository.getAll({ isDeleted: false });

        if (format === "json") {
            return {
                contentType: "application/json",
                filename: "problems.json",
                data: JSON.stringify(problems, null, 2)
            };
        } else if (format === "csv") {
            let csv = "problemId,title,slug,difficulty,category,tags\n";
            for (const p of problems) {
                csv += `${p.problemId},"${p.title.replace(/"/g, '""')}","${p.slug}",${p.difficulty},"${p.category || ""}","${p.tags.join(";")}"\n`;
            }
            return {
                contentType: "text/csv",
                filename: "problems.csv",
                data: csv
            };
        } else if (format === "zip") {
            const zip = new AdmZip();
            zip.addFile("problems.json", Buffer.from(JSON.stringify(problems, null, 2), "utf8"));

            const testcases = await TestCaseModel.find({ isDeleted: false });
            zip.addFile("testcases.json", Buffer.from(JSON.stringify(testcases, null, 2), "utf8"));

            return {
                contentType: "application/zip",
                filename: "problems_export.zip",
                data: zip.toBuffer()
            };
        } else {
            throw new BadRequestError("Unsupported export format.");
        }
    }

    static async getDashboardStats() {
        const cacheKey = "admin:dashboard:stats";
        let stats = await cacheService.get(cacheKey);
        if (stats) {
            // Update dynamic system fields even when reading from cache
            stats.system.uptime = process.uptime();
            stats.system.memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024);
            return stats;
        }

        const totalProblems = await ProblemModel.countDocuments({ isDeleted: false });
        const easyProblems = await ProblemModel.countDocuments({ isDeleted: false, difficulty: "easy" });
        const mediumProblems = await ProblemModel.countDocuments({ isDeleted: false, difficulty: "medium" });
        const hardProblems = await ProblemModel.countDocuments({ isDeleted: false, difficulty: "hard" });
        const totalUsers = await UserModel.countDocuments({ isDeleted: { $ne: true } });

        const totalSubmissions = await SubmissionRepository.countSubmissions();

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        // Count using standard model count (or customized in repository)
        const submissionsToday = await SubmissionModel.countDocuments({
            submittedAt: { $gte: startOfToday },
        });

        const acceptedCount = await SubmissionRepository.countSuccessSubmissions();
        const acceptanceRate = totalSubmissions > 0
            ? Math.round((acceptedCount / totalSubmissions) * 100)
            : 0;

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const activityAgg = await SubmissionModel.aggregate([
            { $match: { submittedAt: { $gte: ninetyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const activityByDay: Record<string, number> = {};
        for (const a of activityAgg) {
            activityByDay[a._id] = a.count;
        }

        const topRecentSubmissions = await SubmissionRepository.aggregateRecentSubmissions(10);

        const dbState = mongoose.connection.readyState === 1 ? "Healthy" : "Degraded";

        stats = {
            problems: { total: totalProblems, easy: easyProblems, medium: mediumProblems, hard: hardProblems },
            users: { total: totalUsers },
            submissions: { total: totalSubmissions, today: submissionsToday, acceptanceRate },
            activity: activityByDay,
            recentSubmissions: topRecentSubmissions,
            system: {
                dbStatus: dbState,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024),
            },
        };

        await cacheService.set(cacheKey, stats, 60); // Cache for 60 seconds
        return stats;
    }

    static async getUsers(params: { page?: number; limit?: number; search?: string; role?: string }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
        const skip = (page - 1) * limit;

        const query: any = {};
        if (params.role && (params.role === "user" || params.role === "admin")) {
            query.role = params.role;
        }

        if (params.search && typeof params.search === "string" && params.search.trim()) {
            const cleanSearch = params.search.trim().replace(/[^a-zA-Z0-9._@-]/g, "");
            if (cleanSearch) {
                const regex = new RegExp(cleanSearch, "i");
                query.$or = [{ username: regex }, { email: regex }];
            }
        }

        const total = await UserRepository.countUsers(query);
        const usersList = await UserRepository.findPaginated(query, skip, limit);
        const totalPages = Math.ceil(total / limit) || 1;

        const users = usersList.map(u => ({
            id: u._id.toString(),
            username: u.username,
            email: u.email,
            role: u.role,
            provider: u.provider || "local",
            rating: u.rating || 1500,
            rank: u.rank || 0,
            problems_solved_count: u.problems_solved_count || 0,
            problems_attempted_count: u.problems_attempted_count || 0,
            createdAt: u.createdAt
        }));

        return {
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    static async getUserById(id: string) {
        const user = await UserRepository.findByIdIncludeDeleted(id);
        if (!user || user.isDeleted) {
            throw new NotFoundError("User not found.");
        }

        const submissionCount = await SubmissionModel.countDocuments({ userId: id });

        return {
            profile: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                display_name: user.display_name,
                bio: user.bio,
                location: user.location,
                company: user.company,
                website: user.website,
                github: user.github,
                linkedin: user.linkedin,
                avatar_url: user.avatar_url,
                role: user.role,
                createdAt: user.createdAt,
            },
            statistics: {
                problems_solved_count: user.problems_solved_count || 0,
                problems_solved_easy: user.problems_solved_easy || 0,
                problems_solved_medium: user.problems_solved_medium || 0,
                problems_solved_hard: user.problems_solved_hard || 0,
                problems_attempted_count: user.problems_attempted_count || 0,
                longest_streak: user.longest_streak || 0,
                submission_count: submissionCount,
            },
            provider: user.provider || "local",
            rating: user.rating || 1500,
            rank: user.rank || 0,
            solved_problems: user.problems_solved || [],
            submission_count: submissionCount,
        };
    }

    static async updateUserRole(id: string, role: string, dbUser: any, ip: string) {
        if (role !== "user" && role !== "admin") {
            throw new BadRequestError("Role must be either 'user' or 'admin'.");
        }

        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        if (user.role === "admin" && role === "user") {
            const adminCount = await UserRepository.countUsers({ role: "admin", isBanned: { $ne: true }, isDeleted: { $ne: true } });
            if (adminCount <= 1) {
                throw new BadRequestError("Cannot remove the last active admin account.");
            }
        }

        user.role = role as "user" | "admin";
        await user.save();

        await AuditLog.create({
            action: "UPDATE_USER_ROLE",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated role for user "${user.username}" (ID: ${user._id}) to "${role}"`,
            ipAddress: ip
        });

        return user;
    }

    static async deleteAdminUser(id: string, dbUser: any, ip: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        if (user.role === "admin") {
            const adminCount = await UserRepository.countUsers({ role: "admin", isBanned: { $ne: true }, isDeleted: { $ne: true } });
            if (adminCount <= 1) {
                throw new BadRequestError("Cannot delete the last active admin account.");
            }
        }

        await UserRepository.softDelete(id);

        await AuditLog.create({
            action: "DELETE_USER",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Soft deleted user account "${user.username}" (ID: ${user._id})`,
            ipAddress: ip
        });

        return { message: "User account soft-deleted successfully." };
    }

    static async getContests(params: { page?: number; limit?: number; search?: string; status?: string }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
        const skip = (page - 1) * limit;

        const query: any = {};
        if (params.status && ["upcoming", "live", "past"].includes(params.status)) {
            query.status = params.status;
        }

        if (params.search && typeof params.search === "string" && params.search.trim()) {
            const cleanSearch = params.search.trim().replace(/[^a-zA-Z0-9._\s-]/g, "");
            if (cleanSearch) {
                query.title = new RegExp(cleanSearch, "i");
            }
        }

        const total = await ContestRepository.countContests(query);
        const contests = await ContestRepository.findPaginated(query, skip, limit);
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            contests,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    static async getContestById(id: string) {
        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }
        return contest;
    }

    static async createContest(contestData: any, dbUser: any, ip: string) {
        const { title, start_time, end_time, duration_minutes, problems, type, description, registration_open } = contestData;

        if (!title || !start_time || !end_time) {
            throw new BadRequestError("title, start_time, and end_time are required.");
        }

        const start = new Date(start_time);
        const end = new Date(end_time);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new BadRequestError("Invalid start_time or end_time date format.");
        }

        if (end <= start) {
            throw new BadRequestError("end_time must be greater than start_time.");
        }

        const maxContest = await ContestModel.findOne().sort({ id: -1 });
        const nextId = (maxContest?.id || 0) + 1;

        let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (!baseSlug) baseSlug = `contest-${nextId}`;

        let slug = baseSlug;
        let counter = 1;
        while (await ContestRepository.findBySlug(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const now = new Date();
        let status: "upcoming" | "live" | "past" = "upcoming";
        if (now >= start && now <= end) {
            status = "live";
        } else if (now > end) {
            status = "past";
        }

        const contest = await ContestRepository.create({
            id: nextId,
            title,
            slug,
            description: description || "",
            type: type || "weekly",
            status,
            start_time: start,
            end_time: end,
            duration_minutes: duration_minutes || Math.round((end.getTime() - start.getTime()) / 60000),
            problems: Array.isArray(problems) ? problems : [],
            registration_open: registration_open !== false,
        });

        // Invalidate caching
        await cacheService.del("contests:all");
        await cacheService.del("contests:upcoming");
        await cacheService.del("contests:live");
        await cacheService.del("contests:past");

        await AuditLog.create({
            action: "CREATE_CONTEST",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Created contest: "${title}" (ID: ${nextId})`,
            ipAddress: ip
        });

        return contest;
    }

    static async updateContest(id: string, contestData: any, dbUser: any, ip: string) {
        const existing = await ContestRepository.findByIdOrNumericId(id);
        if (!existing) {
            throw new NotFoundError("Contest not found.");
        }

        const start = contestData.start_time ? new Date(contestData.start_time) : existing.start_time;
        const end = contestData.end_time ? new Date(contestData.end_time) : existing.end_time;

        if (end <= start) {
            throw new BadRequestError("end_time must be greater than start_time.");
        }

        const updated = await ContestRepository.update(id, {
            ...contestData,
            start_time: start,
            end_time: end,
        });

        // Invalidate caching
        await cacheService.del("contests:all");
        await cacheService.del("contests:upcoming");
        await cacheService.del("contests:live");
        await cacheService.del("contests:past");
        await cacheService.del(`contest:${existing.slug}`);

        await AuditLog.create({
            action: "UPDATE_CONTEST",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated contest: "${updated?.title}" (ID: ${updated?.id})`,
            ipAddress: ip
        });

        return updated;
    }

    static async deleteContest(id: string, dbUser: any, ip: string) {
        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }

        await ContestRepository.softDelete(id);

        // Invalidate caching
        await cacheService.del("contests:all");
        await cacheService.del("contests:upcoming");
        await cacheService.del("contests:live");
        await cacheService.del("contests:past");
        await cacheService.del(`contest:${contest.slug}`);

        await AuditLog.create({
            action: "DELETE_CONTEST",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Soft deleted contest: "${contest.title}" (ID: ${contest.id})`,
            ipAddress: ip
        });

        return { message: "Contest soft-deleted successfully." };
    }

    static async getAnalyticsData() {
        const cacheKey = "admin:analytics:data";
        let data = await cacheService.get(cacheKey);
        if (data) {
            return data;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

        // 1. Users Metrics
        const totalUsers = await UserModel.countDocuments({ isDeleted: { $ne: true } });
        const todayUsers = await UserModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfToday } });
        const weeklyUsers = await UserModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: sevenDaysAgo } });
        const monthlyUsers = await UserModel.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: thirtyDaysAgo } });

        // 2. Problems Metrics
        const easyCount = await ProblemModel.countDocuments({ isDeleted: false, status: "published", difficulty: "easy" });
        const mediumCount = await ProblemModel.countDocuments({ isDeleted: false, status: "published", difficulty: "medium" });
        const hardCount = await ProblemModel.countDocuments({ isDeleted: false, status: "published", difficulty: "hard" });

        const mostSolvedProblems = await ProblemModel.find({ isDeleted: false, status: "published" })
            .select("problemId title slug difficulty successCount submissionCount acceptanceRate")
            .sort({ successCount: -1 })
            .limit(5);

        // 3. Submissions Metrics
        const totalSubmissions = await SubmissionModel.countDocuments();
        const acceptedSubmissions = await SubmissionModel.countDocuments({ status: "Accepted" });
        const rejectedSubmissions = totalSubmissions - acceptedSubmissions;
        const acceptanceRate = totalSubmissions > 0 ? Math.round((acceptedSubmissions / totalSubmissions) * 100) : 0;

        // 4. Activity Metrics (90 days)
        const activityAgg = await SubmissionModel.aggregate([
            { $match: { submittedAt: { $gte: ninetyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        const dailySubmissions: Record<string, number> = {};
        for (const a of activityAgg) {
            dailySubmissions[a._id] = a.count;
        }

        // 5. Programming Languages Metrics
        const langAgg = await SubmissionModel.aggregate([
            { $group: { _id: "$language", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
        ]);
        const mostUsedLanguages = langAgg.map(l => ({
            language: l._id || "Unknown",
            count: l.count,
        }));

        data = {
            users: {
                total: totalUsers,
                today: todayUsers,
                weeklyGrowth: weeklyUsers,
                monthlyGrowth: monthlyUsers,
            },
            problems: {
                totalSolved: acceptedSubmissions,
                mostSolved: mostSolvedProblems,
                distribution: {
                    easy: easyCount,
                    medium: mediumCount,
                    hard: hardCount,
                },
            },
            submissions: {
                total: totalSubmissions,
                accepted: acceptedSubmissions,
                rejected: rejectedSubmissions,
                acceptanceRate,
            },
            activity: {
                dailySubmissions,
            },
            languages: {
                mostUsed: mostUsedLanguages,
            },
        };

        await cacheService.set(cacheKey, data, 60); // Cache for 60 seconds
        return data;
    }

    static async getAuditLogs(params: { page?: number; limit?: number; search?: string; action?: string }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
        const skip = (page - 1) * limit;

        const query: any = {};
        if (params.action && params.action !== "all") {
            query.action = params.action;
        }

        if (params.search && typeof params.search === "string" && params.search.trim()) {
            const cleanSearch = params.search.trim().replace(/[^a-zA-Z0-9._\s-]/g, "");
            if (cleanSearch) {
                const regex = new RegExp(cleanSearch, "i");
                query.$or = [{ username: regex }, { details: regex }, { action: regex }];
            }
        }

        const total = await AuditLog.countDocuments(query);
        const logs = await AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    static async getDashboardOverview() {
        const cacheKey = "admin:dashboard:overview";
        let data = await cacheService.get(cacheKey);
        if (data) {
            return data;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayStr = startOfToday.toISOString().split("T")[0];

        // 1. Basic Stats
        const totalUsers = await UserRepository.countUsers({ isDeleted: { $ne: true } });
        const activeUsersToday = await UserModel.countDocuments({
            isDeleted: { $ne: true },
            $or: [
                { solved_dates: todayStr },
                { updatedAt: { $gte: startOfToday } }
            ]
        });

        // 2. Points & Gamification
        const pointsAgg = await UserModel.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: null, totalPoints: { $sum: "$total_points_earned" } } }
        ]);
        const totalRewardPointsDistributed = pointsAgg[0]?.totalPoints || 0;

        // 3. Problems
        const totalProblems = await ProblemRepository.countProblems({ isDeleted: false });
        const easyProblems = await ProblemRepository.countProblems({ isDeleted: false, difficulty: "easy" });
        const mediumProblems = await ProblemRepository.countProblems({ isDeleted: false, difficulty: "medium" });
        const hardProblems = await ProblemRepository.countProblems({ isDeleted: false, difficulty: "hard" });

        // 4. Submissions
        const totalSubmissions = await SubmissionModel.countDocuments();
        const totalAcceptedSubmissions = await SubmissionModel.countDocuments({ status: "Accepted" });
        const todaySubmissions = await SubmissionModel.countDocuments({ submittedAt: { $gte: startOfToday } });
        const acceptanceRate = totalSubmissions > 0 ? Math.round((totalAcceptedSubmissions / totalSubmissions) * 100) : 0;

        // 5. Contests
        const totalContestsCount = await ContestModel.countDocuments({ isDeleted: { $ne: true } });
        const liveContestsCount = await ContestModel.countDocuments({
            isDeleted: { $ne: true },
            start_time: { $lte: now },
            end_time: { $gte: now }
        });

        // 6. Recent Audit Logs
        const recentAuditLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(5);

        // 7. System Health
        const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
        const uptimeSeconds = Math.floor(process.uptime());

        data = {
            totalUsers,
            activeUsersToday,
            totalRewardPointsDistributed,
            totalProblems,
            easyProblems,
            mediumProblems,
            hardProblems,
            totalSubmissions,
            totalAcceptedSubmissions,
            todaySubmissions,
            acceptanceRate,
            totalContestsCount,
            liveContestsCount,
            recentAuditLogs,
            dbStatus,
            uptimeSeconds,
        };

        await cacheService.set(cacheKey, data, 30); // 30s cache
        return data;
    }

    static async setUserStatus(id: string, isBanned: boolean, reason: string | undefined, dbUser: any, ip: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        if (user.role === "admin") {
            throw new BadRequestError("Cannot ban an administrator account.");
        }

        user.isBanned = Boolean(isBanned);
        user.banReason = reason || "";
        await user.save();

        await AuditLog.create({
            action: isBanned ? "BAN_USER" : "UNBAN_USER",
            userId: dbUser._id,
            username: dbUser.username,
            details: `${isBanned ? "Banned" : "Unbanned"} user "${user.username}" (ID: ${user._id}). Reason: ${reason || "N/A"}`,
            ipAddress: ip
        });

        await cacheService.del(`user:profile:${user.username}`);
        return user;
    }

    static async adjustUserPoints(id: string, amount: number, reason: string, dbUser: any, ip: string) {
        if (!amount || typeof amount !== "number" || isNaN(amount)) {
            throw new BadRequestError("Amount must be a valid number.");
        }

        if (!reason || !reason.trim()) {
            throw new BadRequestError("Reason for points adjustment is required.");
        }

        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        user.points = Math.max(0, (user.points || 0) + amount);
        if (amount > 0) {
            user.total_points_earned = (user.total_points_earned || 0) + amount;
        }

        await user.save();

        await AuditLog.create({
            action: "MANUAL_POINTS_ADJUSTMENT",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Adjusted points by ${amount > 0 ? `+${amount}` : amount} for user "${user.username}". Reason: ${reason}`,
            ipAddress: ip
        });

        await cacheService.del(`user:profile:${user.username}`);
        return user;
    }

    static async getUserSubmissions(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        const submissions = await SubmissionModel.find({ userId: user._id })
            .sort({ submittedAt: -1 })
            .limit(100);

        return submissions;
    }

    static async getUserContests(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        const userSubmissions = await SubmissionModel.find({ userId: user._id }).select("problemSlug");
        const solvedSlugs = Array.from(new Set(userSubmissions.map(s => s.problemSlug)));

        const contests = await ContestModel.find({
            problems: { $in: solvedSlugs },
            isDeleted: { $ne: true }
        }).sort({ start_time: -1 }).limit(20);

        return contests;
    }

    static async getProblemAnalytics(id: string) {
        const problem = await ProblemRepository.findByIdOrNumericId(id);
        if (!problem) {
            throw new NotFoundError("Problem not found.");
        }

        const totalAttempts = await SubmissionModel.countDocuments({ problemId: problem._id });
        const acceptedSubmissions = await SubmissionModel.countDocuments({ problemId: problem._id, status: "Accepted" });
        const rejectedSubmissions = totalAttempts - acceptedSubmissions;
        const failureRate = totalAttempts > 0 ? Math.round((rejectedSubmissions / totalAttempts) * 100) : 0;

        const runtimeAgg = await SubmissionModel.aggregate([
            { $match: { problemId: problem._id, status: "Accepted" } },
            { $group: { _id: null, avgRuntime: { $avg: "$runtime" } } }
        ]);

        const avgSolvingTime = runtimeAgg[0]?.avgRuntime ? Math.round(runtimeAgg[0].avgRuntime) : 0;

        return {
            problemId: problem.problemId,
            title: problem.title,
            slug: problem.slug,
            difficulty: problem.difficulty,
            status: problem.status,
            points: problem.points || 0,
            totalAttempts,
            acceptedSubmissions,
            rejectedSubmissions,
            failureRate,
            avgSolvingTime,
            acceptanceRate: problem.acceptanceRate || 0,
        };
    }

    static async updateProblemWorkflow(id: string, status: string, dbUser: any, ip: string) {
        const validStatuses = ["draft", "pending_review", "published", "archived"];
        if (!validStatuses.includes(status)) {
            throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
        }

        const problem = await ProblemRepository.findByIdOrNumericId(id);
        if (!problem) {
            throw new NotFoundError("Problem not found.");
        }

        problem.status = status as any;
        await problem.save();

        await cacheService.del("problems:global");
        await cacheService.del(`problem:${problem.slug}`);

        await AuditLog.create({
            action: "UPDATE_PROBLEM_STATUS",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated problem status for "${problem.title}" (ID: ${problem.problemId}) to "${status}"`,
            ipAddress: ip
        });

        return problem;
    }

    static async updateProblemPoints(id: string, points: number, dbUser: any, ip: string) {
        if (typeof points !== "number" || points < 0) {
            throw new BadRequestError("Points must be a non-negative number.");
        }

        const problem = await ProblemRepository.findByIdOrNumericId(id);
        if (!problem) {
            throw new NotFoundError("Problem not found.");
        }

        problem.points = points;
        await problem.save();

        await cacheService.del("problems:global");
        await cacheService.del(`problem:${problem.slug}`);

        await AuditLog.create({
            action: "UPDATE_PROBLEM_POINTS",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Updated points for problem "${problem.title}" (ID: ${problem.problemId}) to ${points}`,
            ipAddress: ip
        });

        return problem;
    }

    static async getContestParticipants(id: string) {
        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }

        const contestSubmissions = await SubmissionModel.find({
            problemSlug: { $in: contest.problems },
            submittedAt: { $gte: contest.start_time, $lte: contest.end_time }
        }).select("userId username problemSlug status submittedAt").sort({ submittedAt: 1 });

        const userMap: Record<string, { username: string; totalSubmissions: number; solvedSlugs: Set<string> }> = {};

        for (const sub of contestSubmissions) {
            const uKey = sub.userId ? sub.userId.toString() : sub.username;
            if (!userMap[uKey]) {
                userMap[uKey] = {
                    username: sub.username,
                    totalSubmissions: 0,
                    solvedSlugs: new Set()
                };
            }
            userMap[uKey].totalSubmissions++;
            if (sub.status === "Accepted") {
                userMap[uKey].solvedSlugs.add(sub.problemSlug);
            }
        }

        const participants = Object.values(userMap).map(u => ({
            username: u.username,
            totalSubmissions: u.totalSubmissions,
            solvedCount: u.solvedSlugs.size,
            score: u.solvedSlugs.size * 100,
        })).sort((a, b) => b.score !== a.score ? b.score - a.score : a.totalSubmissions - b.totalSubmissions);

        return {
            contestId: contest.id,
            title: contest.title,
            totalParticipants: participants.length,
            participants
        };
    }

    static async getContestLeaderboard(id: string) {
        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }

        const startTimeMs = new Date(contest.start_time).getTime();

        const contestSubmissions = await SubmissionModel.find({
            problemSlug: { $in: contest.problems },
            submittedAt: { $gte: contest.start_time, $lte: contest.end_time }
        }).select("userId username problemSlug status submittedAt").sort({ submittedAt: 1 });

        interface UserProbState {
            solved: boolean;
            solveTimeMins: number;
            wrongAttemptsBeforeSolve: number;
            lastAcTimeMs: number;
        }

        interface UserState {
            username: string;
            problems: Record<string, UserProbState>;
        }

        const userMap: Record<string, UserState> = {};

        for (const sub of contestSubmissions) {
            const uKey = sub.userId ? sub.userId.toString() : sub.username;
            if (!userMap[uKey]) {
                userMap[uKey] = {
                    username: sub.username,
                    problems: {}
                };
            }

            const pSlug = sub.problemSlug;
            if (!userMap[uKey].problems[pSlug]) {
                userMap[uKey].problems[pSlug] = {
                    solved: false,
                    solveTimeMins: 0,
                    wrongAttemptsBeforeSolve: 0,
                    lastAcTimeMs: 0
                };
            }

            const probState = userMap[uKey].problems[pSlug];

            // Ignore subsequent submissions once problem is solved
            if (probState.solved) {
                continue;
            }

            if (sub.status === "Accepted") {
                probState.solved = true;
                const subTimeMs = new Date(sub.submittedAt).getTime();
                probState.solveTimeMins = Math.max(0, Math.floor((subTimeMs - startTimeMs) / 60000));
                probState.lastAcTimeMs = subTimeMs;
            } else if (sub.status !== "Compilation Error") {
                // Wrong submission penalty incurred only for non-CE attempts before AC
                probState.wrongAttemptsBeforeSolve += 1;
            }
        }

        const leaderboard = Object.values(userMap).map(u => {
            let solvedCount = 0;
            let totalPenalty = 0;
            let maxAcTimeMs = 0;

            for (const pState of Object.values(u.problems)) {
                if (pState.solved) {
                    solvedCount += 1;
                    totalPenalty += pState.solveTimeMins + (pState.wrongAttemptsBeforeSolve * 20);
                    if (pState.lastAcTimeMs > maxAcTimeMs) {
                        maxAcTimeMs = pState.lastAcTimeMs;
                    }
                }
            }

            const score = solvedCount * 100;

            return {
                username: u.username,
                solvedCount,
                penalty: totalPenalty,
                score,
                maxAcTimeMs
            };
        });

        leaderboard.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.penalty !== b.penalty) return a.penalty - b.penalty;
            return a.maxAcTimeMs - b.maxAcTimeMs;
        });

        const formattedLeaderboard = leaderboard.map((u, idx) => ({
            rank: idx + 1,
            username: u.username,
            solvedCount: u.solvedCount,
            penalty: u.penalty,
            score: u.score
        }));

        const totalProblemsSolved = formattedLeaderboard.reduce((acc, u) => acc + u.solvedCount, 0);
        const avgScore = formattedLeaderboard.length > 0 ? Math.round(formattedLeaderboard.reduce((acc, u) => acc + u.score, 0) / formattedLeaderboard.length) : 0;
        const topPerformers = formattedLeaderboard.slice(0, 3);

        return {
            contest: {
                id: contest.id,
                title: contest.title,
                slug: contest.slug,
                status: contest.status,
                start_time: contest.start_time,
                end_time: contest.end_time,
                announcements: contest.announcements || [],
            },
            isFrozen: Boolean(contest.isFrozen),
            leaderboard: formattedLeaderboard,
            statistics: {
                participantsCount: formattedLeaderboard.length,
                totalProblemsSolved,
                avgScore,
                topPerformers
            }
        };
    }

    static async freezeContestLeaderboard(id: string, isFrozen: boolean, dbUser: any, ip: string) {
        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }

        contest.isFrozen = Boolean(isFrozen);
        await contest.save();

        await cacheService.del("contests:all");
        await cacheService.del(`contest:${contest.slug}`);

        await AuditLog.create({
            action: isFrozen ? "FREEZE_CONTEST" : "UNFREEZE_CONTEST",
            userId: dbUser._id,
            username: dbUser.username,
            details: `${isFrozen ? "Froze" : "Unfroze"} leaderboard for contest "${contest.title}" (ID: ${contest.id})`,
            ipAddress: ip
        });

        return contest;
    }

    static async addContestAnnouncement(id: string, message: string, dbUser: any, ip: string) {
        if (!message || !message.trim()) {
            throw new BadRequestError("Announcement message is required.");
        }

        const contest = await ContestRepository.findByIdOrNumericId(id);
        if (!contest) {
            throw new NotFoundError("Contest not found.");
        }

        if (!contest.announcements) {
            contest.announcements = [];
        }

        contest.announcements.push({
            message: message.trim(),
            createdAt: new Date()
        });

        await contest.save();

        await cacheService.del("contests:all");
        await cacheService.del(`contest:${contest.slug}`);

        await AuditLog.create({
            action: "CREATE_CONTEST_ANNOUNCEMENT",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Added announcement to contest "${contest.title}": "${message.trim()}"`,
            ipAddress: ip
        });

        return contest;
    }

    static async getAllPointsTransactions(params: { page?: number; limit?: number }) {
        const page = Math.max(1, Number(params.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(params.limit) || 15));
        const skip = (page - 1) * limit;

        const total = await PointsTransaction.countDocuments();
        const transactions = await PointsTransaction.find()
            .populate("userId", "username email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(total / limit) || 1;

        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    }

    static async rewardUser(id: string, points: number, type: string | undefined, reason: string, dbUser: any, ip: string) {
        if (typeof points !== "number" || isNaN(points) || points === 0) {
            throw new BadRequestError("Points must be a non-zero number.");
        }

        if (!reason || !reason.trim()) {
            throw new BadRequestError("Reason for reward is required.");
        }

        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        user.points = Math.max(0, (user.points || 0) + points);
        if (points > 0) {
            user.total_points_earned = (user.total_points_earned || 0) + points;
        }

        await user.save();

        const validTypes = ["problem_solved", "contest_reward", "manual_adjustment", "bonus"];
        const txType = validTypes.includes(type || "") ? type as any : "manual_adjustment";

        await PointsTransaction.create({
            userId: user._id,
            points,
            type: txType,
            reason: reason.trim(),
            createdBy: dbUser._id,
        });

        await AuditLog.create({
            action: "ADMIN_REWARD_POINTS",
            userId: dbUser._id,
            username: dbUser.username,
            details: `Rewarded ${points > 0 ? `+${points}` : points} points (${txType}) to user "${user.username}". Reason: ${reason.trim()}`,
            ipAddress: ip
        });

        await cacheService.del(`user:profile:${user.username}`);
        return user;
    }

    static async getAdvancedAnalytics() {
        const cacheKey = "admin:analytics:advanced";
        let data = await cacheService.get(cacheKey);
        if (data) {
            return data;
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);

        // Build continuous 30-day date map for smooth chart visualization
        const dateList: string[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            dateList.push(d.toISOString().split("T")[0]);
        }

        // 1. User growth trend (last 30 days)
        const userGrowthAgg = await UserModel.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo }, isDeleted: { $ne: true } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                newUsers: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);

        const growthMap: Record<string, number> = {};
        for (const item of userGrowthAgg) {
            growthMap[item._id] = item.newUsers;
        }

        let runningTotal = await UserModel.countDocuments({ createdAt: { $lt: thirtyDaysAgo }, isDeleted: { $ne: true } });
        const userGrowthTrend = dateList.map(dateStr => {
            const newUsers = growthMap[dateStr] || 0;
            runningTotal += newUsers;
            return {
                date: dateStr,
                newUsers,
                totalUsers: runningTotal
            };
        });

        // 2. Daily Active Users (DAU) & Monthly Active Users (MAU)
        const dauUsers = await SubmissionModel.distinct("userId", { submittedAt: { $gte: todayStart } });
        const mauUsers = await SubmissionModel.distinct("userId", { submittedAt: { $gte: thirtyDaysAgo } });

        const dau = dauUsers.length;
        const mau = mauUsers.length;

        // 3. Problem solving trends (last 30 days daily accepted vs rejected)
        const solvingTrendsAgg = await SubmissionModel.aggregate([
            { $match: { submittedAt: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
                    status: "$status"
                },
                count: { $sum: 1 }
            }}
        ]);

        const solvingDateMap: Record<string, { date: string; accepted: number; rejected: number; total: number }> = {};
        for (const dateStr of dateList) {
            solvingDateMap[dateStr] = { date: dateStr, accepted: 0, rejected: 0, total: 0 };
        }

        for (const item of solvingTrendsAgg) {
            const date = item._id.date;
            if (solvingDateMap[date]) {
                solvingDateMap[date].total += item.count;
                if (item._id.status === "Accepted") {
                    solvingDateMap[date].accepted += item.count;
                } else {
                    solvingDateMap[date].rejected += item.count;
                }
            }
        }
        const problemSolvingTrends = Object.values(solvingDateMap);

        // 4. Difficulty popularity (indexed match over last 30 days)
        const diffPopularityAgg = await SubmissionModel.aggregate([
            { $match: { submittedAt: { $gte: thirtyDaysAgo } } },
            { $lookup: {
                from: "problemnews",
                localField: "problemId",
                foreignField: "_id",
                as: "problem"
            }},
            { $unwind: "$problem" },
            { $group: {
                _id: "$problem.difficulty",
                count: { $sum: 1 }
            }}
        ]);

        const difficultyPopularity = {
            easy: diffPopularityAgg.find(d => d._id === "easy")?.count || 0,
            medium: diffPopularityAgg.find(d => d._id === "medium")?.count || 0,
            hard: diffPopularityAgg.find(d => d._id === "hard")?.count || 0,
        };

        // 5. User Retention Cohort Analysis
        const totalUsersCount = await UserModel.countDocuments({ isDeleted: { $ne: true } });
        const active7Days = await SubmissionModel.distinct("userId", { submittedAt: { $gte: new Date(now.getTime() - 7 * 86400000) } });
        const active14Days = await SubmissionModel.distinct("userId", { submittedAt: { $gte: new Date(now.getTime() - 14 * 86400000) } });

        const retention = {
            week1Rate: totalUsersCount > 0 ? Math.round((active7Days.length / totalUsersCount) * 100) : 0,
            week2Rate: totalUsersCount > 0 ? Math.round((active14Days.length / totalUsersCount) * 100) : 0,
            month1Rate: totalUsersCount > 0 ? Math.round((mau / totalUsersCount) * 100) : 0,
        };

        // 6. Coding language trends
        const langAgg = await SubmissionModel.aggregate([
            { $group: { _id: "$language", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const totalSubmissions = await SubmissionModel.countDocuments();
        const codingLanguageTrends = langAgg.map(item => ({
            language: item._id || "Unknown",
            count: item.count,
            percentage: totalSubmissions > 0 ? Math.round((item.count / totalSubmissions) * 100) : 0
        }));

        data = {
            userGrowthTrend,
            dau,
            mau,
            problemSolvingTrends,
            difficultyPopularity,
            retention,
            codingLanguageTrends,
        };

        await cacheService.set(cacheKey, data, 60); // 60s cache
        return data;
    }
}
