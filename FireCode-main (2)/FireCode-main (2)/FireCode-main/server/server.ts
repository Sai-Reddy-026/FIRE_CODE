require("dotenv").config();
import express from "express";
import router from "./routes/index";
import mongoose from "mongoose";
import { customCors } from "./middlewares/cors";
import { helmetHeaders, mongoSanitize, globalRateLimiter, xssProtection, csrfProtection } from "./middlewares/security";
import { runDatabaseMigration } from "./utils/migration";
import compression from "compression";
import { errorHandler } from "./middlewares/error";
import { startSubmissionWorker, stopSubmissionWorker } from "./workers/submission.worker";

import { requestTracing } from "./middlewares/tracing";
import healthRouter from "./routes/health";
import { initDbProfiler } from "./utils/dbProfiler";
import { logger } from "./utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// BUG-01/BUG-02 FIX: Startup Configuration Validation
// Fail fast with a clear, actionable error message if any required secret is
// missing or below minimum length. This prevents the server from starting in
// a broken state where JWT signing silently fails.
//
// Required secrets:
//   ACCESS_TOKEN_SECRET  — signs access JWTs (7-day expiry)
//   REFRESH_TOKEN_SECRET — signs refresh JWTs (30-day expiry)
//
// Generate with: node -e "require('crypto').randomBytes(64).toString('hex')"
// ─────────────────────────────────────────────────────────────────────────────
const MIN_SECRET_LENGTH = 32; // 32 chars minimum; 128-char hex (64-byte) recommended

function validateStartupConfig(): void {
    const errors: string[] = [];

    const accessSecret = process.env.ACCESS_TOKEN_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

    if (!accessSecret) {
        errors.push("ACCESS_TOKEN_SECRET is not set.");
    } else if (accessSecret.startsWith("CHANGE_ME")) {
        errors.push("ACCESS_TOKEN_SECRET still has the placeholder value. Generate a real secret.");
    } else if (accessSecret.length < MIN_SECRET_LENGTH) {
        errors.push(`ACCESS_TOKEN_SECRET is too short (${accessSecret.length} chars). Minimum: ${MIN_SECRET_LENGTH}.`);
    }

    if (!refreshSecret) {
        errors.push("REFRESH_TOKEN_SECRET is not set.");
    } else if (refreshSecret.startsWith("CHANGE_ME")) {
        errors.push("REFRESH_TOKEN_SECRET still has the placeholder value. Generate a real secret.");
    } else if (refreshSecret.length < MIN_SECRET_LENGTH) {
        errors.push(`REFRESH_TOKEN_SECRET is too short (${refreshSecret.length} chars). Minimum: ${MIN_SECRET_LENGTH}.`);
    }

    if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
        errors.push("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be DIFFERENT secrets.");
    }

    if (errors.length > 0) {
        const boundary = "═".repeat(64);
        console.error(`\n${boundary}`);
        console.error("  FATAL: FireCode server startup configuration errors:");
        errors.forEach((e) => console.error(`  ✗ ${e}`));
        console.error(`\n  Generate secrets: node -e "require('crypto').randomBytes(64).toString('hex')"`);
        console.error(`  Then set them in your .env file (see .env.example for guidance).`);
        console.error(`${boundary}\n`);
        process.exit(1);
    }
}

// Run config validation immediately — before any other initialization
validateStartupConfig();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/firecode";

// Global Process Exception Handlers
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
});

initDbProfiler();

// Production Connection Pool Configuration
mongoose.connect(MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

export const db = mongoose.connection;

db.on("error", (err) => logger.error("MongoDB connection error:", err));
db.once("open", async () => {
    logger.info("Connected to MongoDB with production connection pool.");
    await runDatabaseMigration();
    startSubmissionWorker();
});

const app: express.Application = express();
const port = process.env.PORT || 80;

app.use(requestTracing as express.RequestHandler);
app.use(compression());
app.use(customCors);
app.use(helmetHeaders);

// IMPORTANT: Parse JSON body BEFORE sanitization middlewares.
// mongoSanitize, xssProtection, and csrfProtection all operate on req.body —
// which is only populated after express.json() runs.
app.use(express.json({ limit: "5mb" }));

app.use(mongoSanitize);
app.use(globalRateLimiter as express.RequestHandler); // 200 requests per minute
app.use(xssProtection);
app.use(csrfProtection);

app.use("/health", healthRouter);
app.use("/api/health", healthRouter);
app.use("/api", router);

app.use(errorHandler as express.ErrorRequestHandler);

const server = app.listen(port, () => {
    logger.info(`FireCode server listening at port: ${port}`);
});

// Graceful Shutdown Handlers
const gracefulShutdown = (signal: string) => {
    logger.info(`[Process] ${signal} received. Closing HTTP server, worker queue, and MongoDB connections...`);
    server.close(async () => {
        try {
            await stopSubmissionWorker();
            await mongoose.connection.close(false);
            logger.info("[Process] Worker queue and MongoDB connection closed safely.");
            process.exit(0);
        } catch (err) {
            logger.error("[Process] Error during graceful shutdown:", err);
            process.exit(1);
        }
    });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
