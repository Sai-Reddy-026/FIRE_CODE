import { Worker } from "bullmq";
import IORedis from "ioredis";
import mongoose from "mongoose";
import SubmissionModel from "../models/submission.model";
import UserModel from "../models/user.model";
import ProblemModel from "../models/problem.model";
import PointsTransaction from "../models/points-transaction.model";
import { TestCaseRepository } from "../repositories/testcase.repository";
import { executeTestCases } from "../utils/createTest";
import cacheService from "../services/cache.service";
import { toDateStr, computeStreaks, getPointsForDifficulty } from "../services/problem.service";
import { logger } from "../utils/logger";
import { metricsRegistry } from "../utils/metrics";
import { runInTransaction } from "../utils/dbTransaction";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let worker: Worker | null = null;
let connection: IORedis | null = null;

export async function processSubmission(submissionId: string, requestId?: string): Promise<void> {
    const startTime = Date.now();
    logger.info(`[Worker] Processing submission ${submissionId}`, { submissionId, requestId });
    metricsRegistry.recordSubmission();

    const submission = await SubmissionModel.findById(submissionId).select("+code");
    if (!submission) {
        logger.warn(`[Worker] Submission not found: ${submissionId}`, { submissionId });
        return;
    }

    // Prevent duplicate execution of an already finalized submission
    if (submission.status !== "Pending" && submission.status !== "Running") {
        logger.info(`[Worker] Submission ${submissionId} already finalized (${submission.status}). Skipping.`, { submissionId });
        return;
    }

    submission.status = "Running";
    await submission.save();

    const prob = await ProblemModel.findById(submission.problemId);
    const user = await UserModel.findById(submission.userId);
    if (!prob || !user) {
        submission.status = "Failed";
        submission.error = "Problem or user associated with this submission no longer exists.";
        await submission.save();
        return;
    }

    const allTestCases = await TestCaseRepository.findByProblemId(prob._id.toString(), { isDeleted: false });
    const sortedAll = allTestCases.sort((a, b) => a.executionOrder - b.executionOrder);

    if (!sortedAll.length) {
        submission.status = "Failed";
        submission.error = "No test cases configured for this problem.";
        await submission.save();
        return;
    }

    const clientLang = submission.language.toLowerCase().replace("c++", "cpp");
    const execStart = Date.now();
    const report = await executeTestCases(prob, sortedAll, submission.code, clientLang);
    const execDuration = Date.now() - execStart;
    metricsRegistry.recordJudgeExec(execDuration, report.status === "Accepted");

    submission.status = report.status;
    submission.runtime = report.runtime;
    submission.memory = report.memory / 1024;
    submission.error = report.results.find(r => r.error_message)?.error_message || undefined;
    submission.input = report.results.find(r => r.status !== "Accepted")?.input || undefined;
    submission.expected_output = report.results.find(r => r.status !== "Accepted")?.expected_output || undefined;
    submission.user_output = report.results.find(r => r.status !== "Accepted")?.user_output || undefined;
    submission.testCasesPassed = report.results.filter(r => r.status === "Accepted").length;
    submission.totalTestCases = report.results.length;

    let pointsTx: any = null;

    if (report.status === "Accepted") {
        prob.successCount += 1;

        if (!user.problems_solved.includes(prob.slug)) {
            user.problems_solved.push(prob.slug);
            user.problems_solved_count += 1;

            // Award points only once per solved problem
            const earnedPoints = getPointsForDifficulty(prob.difficulty);
            user.points = (user.points || 0) + earnedPoints;
            user.total_points_earned = (user.total_points_earned || 0) + earnedPoints;

            pointsTx = new PointsTransaction({
                userId: user._id,
                points: earnedPoints,
                type: "problem_solved",
                reason: `Solved problem: ${prob.title}`,
            });

            if (prob.difficulty === "easy") user.problems_solved_easy += 1;
            else if (prob.difficulty === "medium") user.problems_solved_medium += 1;
            else if (prob.difficulty === "hard") user.problems_solved_hard += 1;
        }

        const todayStr = toDateStr(new Date());
        if (!user.solved_dates) user.solved_dates = [];
        if (!user.solved_dates.includes(todayStr)) {
            user.solved_dates.push(todayStr);
        }

        const { longest } = computeStreaks(user.solved_dates);
        user.longest_streak = Math.max(user.longest_streak || 0, longest);
    } else {
        if (!user.problems_attempted.includes(prob.slug) && !user.problems_solved.includes(prob.slug)) {
            user.problems_attempted.push(prob.slug);
            user.problems_attempted_count += 1;
        }
    }

    prob.submissionCount += 1;
    prob.acceptanceRate = Math.round((prob.successCount / prob.submissionCount) * 100);

    // Execute all updates (Submission, Problem, User, PointsTransaction) in ONE environment-aware MongoDB ACID Transaction
    await runInTransaction(
        async (session) => {
            await submission.save({ session });
            await prob.save({ session });
            await user.save({ session });
            if (pointsTx) {
                await pointsTx.save({ session });
            }
        },
        async () => {
            await submission.save();
            await prob.save();
            await user.save();
            if (pointsTx) {
                await pointsTx.save();
            }
        }
    );

    // BUG-13 FIX: Invalidate all problem-related cache keys including editorial variants.
    // The previous code only deleted problem:${slug} (without :user/:admin suffix)
    // which never matched the actual cache keys used by getProblem() and getEditorial().
    await cacheService.del("problems:global");
    await cacheService.del(`problem:${prob.slug}:user`);
    await cacheService.del(`problem:${prob.slug}:admin`);
    await cacheService.del(`editorial:${prob.slug}:user`);
    await cacheService.del(`editorial:${prob.slug}:admin`);
    await cacheService.del(`user:profile:${user.username}`);
    await cacheService.del("admin:dashboard:stats");
    await cacheService.del("admin:dashboard:overview");

    logger.info(`[Worker] Completed submission ${submissionId}. Verdict: ${report.status}`, { submissionId, verdict: report.status });
}

export function startSubmissionWorker() {
    try {
        connection = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                if (times > 2) return null;
                return Math.min(times * 100, 1000);
            },
        });

        connection.on("error", (err) => {
            logger.error(`[Worker Redis Error]: ${err.message}`);
        });

        worker = new Worker(
            "submission-queue",
            async (job) => {
                const { submissionId, requestId } = job.data;
                await processSubmission(submissionId, requestId);
            },
            {
                connection,
                concurrency: 4,
                lockDuration: 30000,
                // Retry config is set via Queue's defaultJobOptions in queue.service.ts
            }
        );

        worker.on("completed", (job) => {
            logger.info(`[Worker] Job ${job.id} completed successfully.`);
        });

        worker.on("failed", (job, err) => {
            logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`, { jobId: job?.id, error: err });
        });

        worker.on("stalled", (jobId) => {
            logger.warn(`[Worker] Job ${jobId} stalled. Re-evaluating lock...`, { jobId });
        });

        logger.info("BullMQ Submission worker started with concurrency 4, retry: 3 attempts.");
    } catch (e: any) {
        logger.error("Failed to start BullMQ Worker", { error: e.message });
    }
}

export async function stopSubmissionWorker() {
    if (worker) {
        await worker.close();
        logger.info("[Worker] Submission worker stopped safely.");
    }
    if (connection) {
        await connection.quit();
    }
}
