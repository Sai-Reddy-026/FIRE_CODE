import { Request, Response } from "express";
import mongoose from "mongoose";
import cacheService from "../services/cache.service";
import { isQueueAvailable } from "../services/queue.service";
import { metricsRegistry } from "../utils/metrics";

export class HealthController {
    static async getHealth(req: Request, res: Response): Promise<void> {
        const mongoState = mongoose.connection.readyState;
        const mongoStatus = mongoState === 1 ? "up" : "down";
        const redisStatus = cacheService.isAvailable() ? "up" : "degraded";
        const queueStatus = isQueueAvailable() ? "up" : "degraded";
        const judge0Status = process.env.JUDGE0_URL ? "up" : "ready";

        const mem = process.memoryUsage();
        const memorySummary = {
            rssMB: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
            heapUsedMB: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
            heapTotalMB: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
        };

        const overallStatus = mongoStatus === "down"
            ? "error"
            : (redisStatus === "degraded" || queueStatus === "degraded")
                ? "degraded"
                : "ok";

        const httpStatus = overallStatus === "error" ? 503 : 200;

        res.status(httpStatus).json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            system: {
                memory: memorySummary,
                cpu: process.cpuUsage(),
            },
            services: {
                mongodb: { status: mongoStatus },
                redis: { status: redisStatus },
                queue: { status: queueStatus },
                judge0: { status: judge0Status },
            },
            metrics: metricsRegistry.getSummary(),
        });
    }

    static async getMetrics(req: Request, res: Response): Promise<void> {
        res.status(200).json({
            success: true,
            summary: metricsRegistry.getSummary(),
            securityEvents: metricsRegistry.getSecurityEvents(),
        });
    }
}
