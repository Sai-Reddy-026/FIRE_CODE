import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger, requestContextStorage, RequestContext } from "../utils/logger";
import { metricsRegistry } from "../utils/metrics";

export function requestTracing(req: Request, res: Response, next: NextFunction) {
    const headerReqId = req.headers["x-request-id"] || req.headers["x-correlation-id"];
    const requestId = (typeof headerReqId === "string" && headerReqId.trim().length > 0)
        ? headerReqId
        : crypto.randomUUID();

    const ip = (req.headers["x-forwarded-for"] as string || req.ip || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const startTime = Date.now();

    res.setHeader("X-Request-ID", requestId);

    const context: RequestContext = {
        requestId,
        ip,
        method: req.method,
        endpoint: req.originalUrl || req.url,
        startTime,
    };

    res.on("finish", () => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;
        const userId = (req as any).authUser?.id || (req as any).dbUser?._id?.toString() || (req as any).user?.id;

        metricsRegistry.recordRequest(statusCode, durationMs, userId);

        const logPayload = {
            status: statusCode,
            responseTimeMs: durationMs,
            userId,
        };

        if (durationMs > 500) {
            logger.warn(`SLOW_REQUEST [${req.method}] ${req.originalUrl || req.url} - ${durationMs}ms`, logPayload);
        } else {
            logger.info(`HTTP [${req.method}] ${req.originalUrl || req.url} ${statusCode} - ${durationMs}ms`, logPayload);
        }
    });

    requestContextStorage.run(context, () => {
        next();
    });
}
