import mongoose from "mongoose";
import { ProblemRepository } from "../repositories/problem.repository";
import { UserRepository } from "../repositories/user.repository";
import { TestCaseRepository } from "../repositories/testcase.repository";
import { SubmissionRepository } from "../repositories/submission.repository";
import PointsTransaction from "../models/points-transaction.model";
import { toFrontendProblem } from "../utils/dto";
import { executeTestCases, executeDirectSubmission } from "../utils/createTest";
import { NotFoundError, BadRequestError } from "../errors/AppError";
import cacheService from "./cache.service";
import { addSubmissionJob } from "./queue.service";
import { processSubmission } from "../workers/submission.worker";
import { logger } from "../utils/logger";
import { runInTransaction } from "../utils/dbTransaction";

// Judge0 language ID lookup (mirrors createTest.ts)
const JUDGE0_LANG_IDS: Record<string, number> = {
    cpp: 54,
    c: 50,
    java: 62,
    python: 71,
    javascript: 63,
    typescript: 74,
    go: 60,
    rust: 73,
    csharp: 51,
    kotlin: 78,
};

export function toDateStr(d: Date): string {
    return d.toISOString().split("T")[0];
}

export function getPointsForDifficulty(difficulty: string): number {
    if (difficulty === "easy") return 10;
    if (difficulty === "medium") return 25;
    if (difficulty === "hard") return 50;
    return 10;
}

export function computeStreaks(uniqueDates: string[]): { current: number; longest: number } {
    if (!uniqueDates.length) return { current: 0, longest: 0 };

    const sorted = Array.from(new Set(uniqueDates)).sort();

    let longest = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diff === 1) {
            run++;
            if (run > longest) longest = run;
        } else if (diff > 1) {
            run = 1;
        }
    }

    let current = 0;
    const todayStr = toDateStr(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateStr(yesterday);

    const hasToday = sorted.includes(todayStr);
    const hasYesterday = sorted.includes(yesterdayStr);

    if (hasToday || hasYesterday) {
        let expected = hasToday ? new Date(todayStr) : new Date(yesterdayStr);
        for (let i = sorted.length - 1; i >= 0; i--) {
            const dateStr = sorted[i];
            const dateVal = new Date(dateStr);
            const expectedStr = toDateStr(expected);

            if (dateStr === expectedStr) {
                current++;
                expected.setDate(expected.getDate() - 1);
            } else if (dateVal < expected) {
                break;
            }
        }
    }

    return { current, longest };
}

export class ProblemService {
    static async getActivity(userId: string) {
        // Projection: only fetch the 3 fields we actually use — avoids loading the full
        // ~5–20KB user document (refresh_tokens, problems_solved arrays, etc.)
        const user = await UserRepository.findById(userId, "solved_dates longest_streak problems_solved_count");
        if (!user) {
            throw new NotFoundError("User not found");
        }

        const solved_dates: string[] = user.solved_dates || [];
        const uniqueDates = [...new Set(solved_dates)].sort();

        const { current, longest } = computeStreaks(solved_dates);

        const today = toDateStr(new Date());
        const now = new Date();

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const weekStartStr = toDateStr(weekStart);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartStr = toDateStr(monthStart);

        const today_count = solved_dates.filter((d) => d === today).length;
        const week_count = solved_dates.filter((d) => d >= weekStartStr && d <= today).length;
        const month_count = solved_dates.filter((d) => d >= monthStartStr && d <= today).length;

        return {
            solved_dates: uniqueDates,
            current_streak: current,
            longest_streak: Math.max(user.longest_streak || 0, longest),
            today_count,
            week_count,
            month_count,
            total_solved: user.problems_solved_count || 0,
        };
    }

    static async getAllProblems(userId: string, filters: any) {
        const search = filters.search || "";
        const difficulty = filters.difficulty || "";
        const acceptance = filters.acceptance || "";
        const title = filters.title || "";

        const cacheKey = "problems:global";
        let problems: any[] | null = await cacheService.get(cacheKey);
        if (!problems) {
            const projection = "problemId title slug difficulty tags acceptanceRate submissionCount successCount status description constraints inputFormat outputFormat hints editorial examples starterCode";
            problems = await ProblemRepository.getAll({ isDeleted: false, status: "published" }, projection, { problemId: 1 });
            await cacheService.set(cacheKey, problems, 3600);
        }

        let filtered = problems;
        if (search) {
            const lowerSearch = search.toLowerCase();
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(lowerSearch) || 
                p.slug.toLowerCase().includes(lowerSearch)
            );
        }

        if (title === "asc") {
            filtered = [...filtered].sort((a, b) => a.problemId - b.problemId);
        } else if (title === "desc") {
            filtered = [...filtered].sort((a, b) => b.problemId - a.problemId);
        }

        if (acceptance === "asc") {
            filtered = [...filtered].sort((a, b) => a.acceptanceRate - b.acceptanceRate);
        } else if (acceptance === "desc") {
            filtered = [...filtered].sort((a, b) => b.acceptanceRate - a.acceptanceRate);
        }

        const diffRule: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
        if (difficulty === "asc") {
            filtered = [...filtered].sort((a, b) => diffRule[a.difficulty] - diffRule[b.difficulty]);
        } else if (difficulty === "desc") {
            filtered = [...filtered].sort((a, b) => diffRule[b.difficulty] - diffRule[a.difficulty]);
        }

        // Projection: only load the 2 array fields needed for solved/attempted status tagging.
        // The full user document can be 5–20 KB; this query returns ~200 bytes.
        const user = await UserRepository.findById(userId, "problems_solved problems_attempted");
        const solved = user?.problems_solved || [];
        const attempted = user?.problems_attempted || [];

        return filtered.map((p) => {
            let status: string | undefined;
            if (solved.includes(p.slug)) {
                status = "solved";
            } else if (attempted.includes(p.slug)) {
                status = "attempted";
            }
            return toFrontendProblem(p, status);
        });
    }

    static async getProblem(slug: string, userId: string) {
        const user = await UserRepository.findById(userId);
        const isAdmin = user?.role === "admin";

        const options: any = { isDeleted: false };
        if (!isAdmin) {
            options.status = "published";
        }

        const cacheKey = `problem:${slug}:${isAdmin ? "admin" : "user"}`;
        let prob = await cacheService.get(cacheKey);
        if (!prob) {
            prob = await ProblemRepository.findBySlugOrId(slug, options);
            if (!prob) {
                throw new NotFoundError("Problem not found.");
            }
            await cacheService.set(cacheKey, prob, 600);
        }

        let status: string | undefined;
        if (user?.problems_solved?.includes(prob.slug)) {
            status = "solved";
        } else if (user?.problems_attempted?.includes(prob.slug)) {
            status = "attempted";
        }

        return toFrontendProblem(prob, status);
    }

    static async getEditorial(slug: string, userId?: string) {
        let isAdmin = false;
        if (userId) {
            const user = await UserRepository.findById(userId);
            isAdmin = user?.role === "admin";
        }

        const options: any = { isDeleted: false };
        if (!isAdmin) {
            options.status = "published";
        }

        const cacheKey = `editorial:${slug}:${isAdmin ? "admin" : "user"}`;
        let editorialData = await cacheService.get(cacheKey);
        if (!editorialData) {
            const prob = await ProblemRepository.findBySlugOrId(slug, options);
            if (!prob) {
                throw new NotFoundError("Editorial not found.");
            }
            const body = prob.editorial && prob.editorial.trim() 
                ? prob.editorial 
                : "<p class='text-muted-foreground'>No editorial has been written for this problem yet.</p>";
            editorialData = { editorial_body: body };
            await cacheService.set(cacheKey, editorialData, 600);
        }
        return editorialData;
    }

    static async getAdjacent(slug: string) {
        const currentProblem = await ProblemRepository.findBySlugOrId(slug, { isDeleted: false });
        if (!currentProblem) {
            throw new NotFoundError("Problem not found.");
        }

        const currentId = currentProblem.problemId;

        const prevProblem = await ProblemRepository.findOneAdjacent(
            { problemId: { $lt: currentId }, isDeleted: false, status: "published" },
            { problemId: -1 }
        );

        const nextProblem = await ProblemRepository.findOneAdjacent(
            { problemId: { $gt: currentId }, isDeleted: false, status: "published" },
            { problemId: 1 }
        );

        return {
            prev: prevProblem ? prevProblem.slug : null,
            next: nextProblem ? nextProblem.slug : null,
            current_id: currentId
        };
    }

    static async runCode(slug: string, runData: { code: string; language: string; customInput?: string }) {
        const { code, language, customInput } = runData;

        if (!code || typeof code !== "string" || code.trim().length === 0) {
            throw new BadRequestError("Submitted code cannot be empty.");
        }
        if (code.length > 65536) {
            throw new BadRequestError("Submitted code exceeds maximum size limit (64 KB).");
        }

        const clientLang = (language || "javascript").toLowerCase();

        // ─────────────────────────────────────────────────────────────────────
        // CUSTOM INPUT PATH: Run code against user-supplied stdin.
        // The problem statement is NEVER sent to the compiler.
        // This is the primary "Run" mode (like CodeChef custom input).
        // ─────────────────────────────────────────────────────────────────────
        if (typeof customInput === "string") {
            const langId = JUDGE0_LANG_IDS[clientLang];
            if (!langId) {
                throw new BadRequestError(`Unsupported language: ${clientLang}`);
            }

            try {
                const result = await executeDirectSubmission(code, langId, customInput);

                // Determine success / failure from Judge0 status id
                const statusId = result.status?.id ?? 0;
                const isAccepted = statusId === 3;
                const hasCompileError = statusId === 6;
                const hasTLE = statusId === 5;

                const stdout = (result.stdout || "").trim();
                const stderr = (result.stderr || result.compile_output || "").trim();

                let statusLabel = "Accepted";
                if (!isAccepted) {
                    if (hasCompileError) statusLabel = "Compilation Error";
                    else if (hasTLE) statusLabel = "Time Limit Exceeded";
                    else if (statusId >= 7 && statusId <= 12) statusLabel = "Runtime Error";
                    else statusLabel = result.status?.description || "Runtime Error";
                }

                return {
                    success: isAccepted,
                    status: statusLabel,
                    runtime: result.time ? Math.round(parseFloat(result.time) * 1000) : 0,
                    memory: result.memory || 0,
                    stdout: stdout || null,
                    stderr: stderr || null,
                    error_message: (!isAccepted && stderr) ? stderr : null,
                    input: customInput,
                    user_output: stdout || null,
                    expected_output: null, // not applicable for custom input run
                    results: [],
                };
            } catch (err: any) {
                const msg = err?.response?.data?.message || err?.message || "Execution engine unreachable.";
                return {
                    success: false,
                    status: "Runtime Error",
                    runtime: 0,
                    memory: 0,
                    stdout: null,
                    stderr: msg,
                    error_message: msg,
                    input: customInput,
                    user_output: null,
                    expected_output: null,
                    results: [],
                };
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // FALLBACK PATH: Run against visible (sample) test cases from DB.
        // Used when no custom input is provided.
        // ─────────────────────────────────────────────────────────────────────
        const prob = await ProblemRepository.findBySlugOrId(slug, { isDeleted: false });
        if (!prob) {
            throw new NotFoundError("Problem not found");
        }

        const visibleTestCases = await TestCaseRepository.findByProblemId(prob._id.toString(), { isDeleted: false });
        const sortedVisible = visibleTestCases
            .filter(tc => !tc.isHidden)
            .sort((a, b) => a.executionOrder - b.executionOrder);

        if (!sortedVisible.length) {
            // No visible test cases — return informative message instead of throwing
            return {
                success: false,
                status: "No Test Cases",
                runtime: 0,
                memory: 0,
                stdout: null,
                stderr: null,
                error_message: "No sample test cases available. Please use custom input.",
                input: null,
                user_output: null,
                expected_output: null,
                results: [],
            };
        }

        const report = await executeTestCases(prob, sortedVisible, code, clientLang);

        return {
            success: report.status === "Accepted",
            status: report.status,
            runtime: report.runtime,
            memory: report.memory,
            stdout: report.results[0]?.user_output || null,
            stderr: null,
            error_message: report.results.find(r => r.error_message)?.error_message || null,
            input: report.results[0]?.input || null,
            expected_output: report.results[0]?.expected_output || null,
            user_output: report.results[0]?.user_output || null,
            results: report.results,
        };
    }

    static async submitCode(slug: string, userId: string, submitData: { code: string; language: string; problem_name?: string; localDate?: string }) {
        const { code, language, problem_name, localDate } = submitData;

        if (!code || typeof code !== "string" || code.trim().length === 0) {
            throw new BadRequestError("Submitted code cannot be empty.");
        }
        if (code.length > 65536) {
            throw new BadRequestError("Submitted code exceeds maximum size limit (64 KB).");
        }

        const prob = await ProblemRepository.findBySlugOrId(slug, { isDeleted: false });
        const user = await UserRepository.findById(userId);

        if (!prob || !user) {
            throw new NotFoundError("Problem or user not found");
        }

        const allTestCases = await TestCaseRepository.findByProblemId(prob._id.toString(), { isDeleted: false });
        const sortedAll = allTestCases.sort((a, b) => a.executionOrder - b.executionOrder);

        if (!sortedAll.length) {
            throw new BadRequestError("No test cases defined for this problem.");
        }

        const clientLang = language || "javascript";
        const displayLang = clientLang === "cpp" ? "C++" : clientLang.charAt(0).toUpperCase() + clientLang.slice(1);

        const submission = await SubmissionRepository.create({
            userId: user._id,
            username: user.username,
            problemId: prob._id,
            problemSlug: prob.slug,
            problemTitle: problem_name || prob.title,
            status: "Pending",
            language: displayLang,
            code: code,
            runtime: 0,
            memory: 0,
            submittedAt: new Date(),
        });

        const queued = await addSubmissionJob(submission._id.toString());
        if (!queued) {
            logger.warn(`[Queue] Redis unavailable. Triggering async local worker for submission ${submission._id}.`, { submissionId: submission._id });
            setImmediate(() => {
                processSubmission(submission._id.toString()).catch((err: any) => {
                    logger.error("[Local Worker Error] Local submission processing failed", { error: err?.message || String(err) });
                });
            });
        }

        // Return the newly created submission directly — no need for a redundant
        // findByUserAndProblem query immediately after saving (saves 20–60ms per submission).
        const obj = submission.toObject ? submission.toObject() : { ...submission };
        return [{ ...obj, code_body: obj.code, time: obj.submittedAt }];
    }

    static async getSubmissions(slug: string, userId: string) {
        if (!userId) return [];
        const prob = await ProblemRepository.findBySlugOrId(slug, { isDeleted: false });
        const querySlug = prob ? prob.slug : slug;
        const subs = await SubmissionRepository.findByUserAndProblem(userId, querySlug);
        return subs.map(s => {
            const obj = s.toObject ? s.toObject() : { ...s };
            return {
                ...obj,
                code_body: obj.code,
                time: obj.submittedAt
            };
        });
    }
}
