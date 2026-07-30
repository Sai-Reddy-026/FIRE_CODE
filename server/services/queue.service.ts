import { Queue } from "bullmq";
import IORedis from "ioredis";
import { logger } from "../utils/logger";
import { processSubmission } from "../workers/submission.worker";
import SubmissionModel from "../models/submission.model";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisConnection: IORedis | null = null;
let submissionQueue: Queue | null = null;
let isQueueReady = false;

// Skip all Redis/BullMQ setup in test environments — no connection attempts, no ECONNREFUSED noise
if (process.env.NODE_ENV !== "test") {
try {
    redisConnection = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            if (times > 2) return null;
            return Math.min(times * 100, 1000);
        },
    });

    redisConnection.on("error", (err) => {
        logger.warn("[Queue] Redis connection error", { error: err.message });
        isQueueReady = false;
    });
    // Suppress the raw Error stack trace that ioredis prints to stderr by default
    // Our "error" handler above already captures it via logger
    redisConnection.on("error", () => {});

    redisConnection.on("ready", () => {
        logger.info("[Queue] Redis connection ready.");
        isQueueReady = true;
    });

    submissionQueue = new Queue("submission-queue", {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 2000,
            },
            removeOnComplete: { age: 3600, count: 1000 }, // Auto-clean completed jobs after 1h
            removeOnFail: { age: 86400, count: 500 },     // Keep last 500 failed jobs for 24h debug
        },
    });
} catch (e: any) {
    logger.error("BullMQ Queue initialization failed", { error: e.message });
    isQueueReady = false;
}
}

// Fallback in-memory queue & background processing loop when BullMQ Redis is offline
const fallbackQueue: string[] = [];
let isProcessingFallback = false;
let fallbackInterval: NodeJS.Timeout | null = null;

async function processFallbackQueue() {
    // Never run during tests — MongoDB may not be available, causing 10s timeout errors
    if (process.env.NODE_ENV === "test") return;

    if (isProcessingFallback) return;
    isProcessingFallback = true;

    try {
        // 1. Process in-memory queued submissions
        while (fallbackQueue.length > 0) {
            const submissionId = fallbackQueue.shift();
            if (submissionId) {
                try {
                    await processSubmission(submissionId);
                } catch (err: any) {
                    logger.error(`[Fallback Queue Error] Failed processing submission ${submissionId}: ${err.message}`);
                }
            }
        }

        // 2. Persistent backup scan: recover any lingering Pending submissions in DB
        const pendingSubmissions = await SubmissionModel.find({ status: "Pending" })
            .select("+code")
            .limit(5);
        for (const sub of pendingSubmissions) {
            try {
                await processSubmission(sub._id.toString());
            } catch (err: any) {
                logger.error(`[Fallback DB Scan Error] Failed processing submission ${sub._id}: ${err.message}`);
            }
        }
    } catch (err: any) {
        logger.error(`[Fallback Queue Processor Exception]: ${err.message}`);
    } finally {
        isProcessingFallback = false;
    }
}

// Background poller (every 5s) for Redis-offline fallback processing.
// Skipped in test environments to avoid process hang from MongoDB buffering timeouts.
if (!fallbackInterval && process.env.NODE_ENV !== "test") {
    fallbackInterval = setInterval(() => {
        if (!isQueueReady) {
            processFallbackQueue().catch(() => {});
        }
    }, 5000);
}

export function enqueueFallbackSubmission(submissionId: string) {
    if (!fallbackQueue.includes(submissionId)) {
        fallbackQueue.push(submissionId);
    }
    // Skip setImmediate in test environments — no DB or workers available
    if (process.env.NODE_ENV === "test") return;
    // Asynchronously trigger non-blocking background queue drain outside HTTP lifecycle
    setImmediate(() => {
        processFallbackQueue().catch(() => {});
    });
}

export async function addSubmissionJob(submissionId: string, requestId?: string): Promise<boolean> {
    if (!isQueueReady || !submissionQueue) {
        logger.warn("[Queue] Redis unavailable. Submission stored for background processing.", { submissionId, requestId });
        enqueueFallbackSubmission(submissionId);
        return false;
    }
    try {
        await submissionQueue.add("process-submission", { submissionId, requestId, enqueuedAt: Date.now() }, { jobId: submissionId });
        logger.info(`Successfully queued submission job: ${submissionId}`, { submissionId, requestId });
        return true;
    } catch (err: any) {
        logger.warn("[Queue] Redis unavailable. Submission stored for background processing.", { submissionId, requestId, error: err.message });
        enqueueFallbackSubmission(submissionId);
        return false;
    }
}

export function isQueueAvailable(): boolean {
    return isQueueReady;
}
