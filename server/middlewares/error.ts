import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";
import { metricsRegistry } from "../utils/metrics";

export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export function classifyError(err: any): string {
    if (!err) return "UNEXPECTED_ERROR";

    const msg = String(err.message || "").toLowerCase();
    const name = String(err.name || "");

    if (name === "ValidationError" || msg.includes("validation")) {
        return "VALIDATION_ERROR";
    }
    if (name === "CastError" || msg.includes("mongo") || msg.includes("bson") || msg.includes("topology")) {
        return "DATABASE_ERROR";
    }
    if (msg.includes("redis") || msg.includes("econnrefused 127.0.0.1:6379")) {
        return "REDIS_ERROR";
    }
    if (msg.includes("judge") || msg.includes("submission worker")) {
        return "JUDGE0_ERROR";
    }
    if (msg.includes("queue") || msg.includes("bullmq")) {
        return "QUEUE_ERROR";
    }
    if (msg.includes("oauth") || msg.includes("google") || msg.includes("github")) {
        return "OAUTH_ERROR";
    }
    if (msg.includes("jwt") || msg.includes("unauthorized") || msg.includes("token") || msg.includes("forbidden")) {
        return "AUTH_ERROR";
    }
    if (err instanceof AppError) {
        return "APP_ERROR";
    }

    return "UNEXPECTED_ERROR";
}

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let statusCode = 500;
    let message = "Internal Server Error";

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err.name === "ValidationError") {
        statusCode = 400;
        message = err.message;
    } else if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid database reference: ${err.path}`;
    } else if (err.message) {
        message = err.message;
    }

    const errorType = classifyError(err);
    const userId = (req as any).authUser?.id || (req as any).dbUser?._id?.toString() || (req as any).user?.id;

    logger.error(`HTTP_ERROR [${req.method}] ${req.originalUrl || req.url} - ${statusCode} - ${errorType}`, {
        errorType,
        statusCode,
        message,
        userId,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    res.status(statusCode).json({
        success: false,
        message,
    });
};
