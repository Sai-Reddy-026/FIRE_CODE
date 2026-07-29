import { Request, Response, NextFunction } from "express";
import UserModel from "../models/user.model";
import { AdminRequest, AuthRequest } from "../types/auth.types";
import cacheService from "../services/cache.service";
import { logger } from "../utils/logger";
import { metricsRegistry } from "../utils/metrics";

// ─────────────────────────────────────────────
// 1. Helmet-style Security Headers
// ─────────────────────────────────────────────
export function helmetHeaders(req: Request, res: Response, next: NextFunction) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
        "Content-Security-Policy",
        // Allow self + external resources used by the app
        "default-src 'self'; " +
        "img-src 'self' https://api.dicebear.com data:; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "script-src 'self' 'unsafe-inline' blob:; " +
        "worker-src 'self' blob:; " +
        "connect-src 'self'"
    );
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
}

// ─────────────────────────────────────────────
// 2. MongoDB Injection Sanitizer
// (Only strips keys starting with $ or containing . from plain objects)
// ─────────────────────────────────────────────
function sanitize(obj: any): any {
    if (obj && typeof obj === "object" && !(obj instanceof Buffer) && !Array.isArray(obj)) {
        for (const key in obj) {
            if (key.startsWith("$") || key.includes(".")) {
                delete obj[key];
            } else {
                sanitize(obj[key]);
            }
        }
    }
    return obj;
}

export function mongoSanitize(req: Request, res: Response, next: NextFunction) {
    req.body   = sanitize(req.body);
    req.query  = sanitize(req.query);
    req.params = sanitize(req.params);
    next();
}

export interface RateLimiterOptions {
    keyPrefix: string;
    limit: number;
    windowMs: number;
    useUserIdIfAvailable?: boolean;
    customKeyGenerator?: (req: Request) => string;
    message?: string;
}

const inMemoryStores = new Map<string, Map<string, { count: number; resetTime: number }>>();

export function resetRateLimiterStores() {
    inMemoryStores.clear();
}

export function createRateLimiter(options: RateLimiterOptions) {
    const {
        keyPrefix,
        limit,
        windowMs,
        useUserIdIfAvailable = true,
        customKeyGenerator,
        message = "Too many requests, please try again later.",
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        let idKey: string;
        if (customKeyGenerator) {
            idKey = customKeyGenerator(req);
        } else {
            const user = (req as any).authUser || (req as any).dbUser || (req as any).user;
            const userId = user?.id || user?._id?.toString() || user?.userId;
            if (useUserIdIfAvailable && userId) {
                idKey = `user:${userId}`;
            } else {
                const ip = req.ip || req.socket?.remoteAddress || "unknown";
                idKey = `ip:${ip}`;
            }
        }

        const redisKey = `ratelimit:${keyPrefix}:${idKey}`;
        const windowSec = Math.ceil(windowMs / 1000);

        let count: number;
        let remainingTtlSec: number;

        const redisResult = await cacheService.incrWithTtl(redisKey, windowSec);

        if (redisResult !== null) {
            count = redisResult.count;
            remainingTtlSec = redisResult.ttl;
        } else {
            // In-Memory Fallback with Isolated Maps per Key Prefix
            let store = inMemoryStores.get(keyPrefix);
            if (!store) {
                store = new Map();
                inMemoryStores.set(keyPrefix, store);
            }

            const now = Date.now();
            const record = store.get(idKey);

            if (!record || now > record.resetTime) {
                store.set(idKey, { count: 1, resetTime: now + windowMs });
                count = 1;
                remainingTtlSec = windowSec;
            } else {
                record.count++;
                count = record.count;
                remainingTtlSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
            }
        }

        const remaining = Math.max(0, limit - count);
        const resetEpochSec = Math.ceil(Date.now() / 1000) + remainingTtlSec;

        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader("X-RateLimit-Reset", resetEpochSec);

        if (count > limit) {
            metricsRegistry.recordRateLimitViolation();
            logger.security("RATE_LIMIT_VIOLATION", { keyPrefix, idKey, limit, windowMs });
            res.setHeader("Retry-After", remainingTtlSec);
            return res.status(429).json({
                success: false,
                message,
            });
        }

        next();
    };
}

export function rateLimiter(limit: number, windowMs: number) {
    return createRateLimiter({
        keyPrefix: `global:${limit}:${windowMs}`,
        limit,
        windowMs,
    });
}

// ─────────────────────────────────────────────
// Endpoint-specific Rate Limiters
// ─────────────────────────────────────────────
export const loginRateLimiter = createRateLimiter({
    keyPrefix: "auth:login",
    limit: 5,
    windowMs: 60000,
    customKeyGenerator: (req: Request) => {
        const bodyUser = req.body?.email || req.body?.username || "";
        const ip = req.ip || req.socket?.remoteAddress || "unknown";
        return `ip:${ip}:user:${bodyUser}`;
    },
    message: "Too many login attempts. Please try again after a minute.",
});

export const signupRateLimiter = createRateLimiter({
    keyPrefix: "auth:signup",
    limit: 5,
    windowMs: 60000,
    message: "Too many registration attempts. Please try again later.",
});

// BUG-07 FIX: Dedicated refresh limiter — uses IP-only key (no email in body).
// Prevents users on the same network from exhausting each other's login bucket.
export const refreshRateLimiter = createRateLimiter({
    keyPrefix: "auth:refresh",
    limit: 10,
    windowMs: 60000,
    useUserIdIfAvailable: false, // Token may be expired; authUser is not set yet
    message: "Too many token refresh attempts. Please try again later.",
});

// BUG-07 FIX: Dedicated forgot-password limiter — IP-based, stricter than login
export const forgotPasswordRateLimiter = createRateLimiter({
    keyPrefix: "auth:forgot-password",
    limit: 5,
    windowMs: 900000, // 15 minutes — prevents email flooding
    useUserIdIfAvailable: false,
    message: "Too many password reset requests. Please wait 15 minutes before trying again.",
});

export const oauthRateLimiter = createRateLimiter({
    keyPrefix: "auth:oauth",
    limit: 10,
    windowMs: 60000,
    message: "Too many authentication requests. Please try again later.",
});

export const authRateLimiter = createRateLimiter({
    keyPrefix: "auth:general",
    limit: 10,
    windowMs: 60000,
});

export const runCodeRateLimiter = createRateLimiter({
    keyPrefix: "problem:run",
    limit: 10,
    windowMs: 60000,
    message: "Code execution rate limit exceeded. Please wait a moment before running code again.",
});

export const submitCodeRateLimiter = createRateLimiter({
    keyPrefix: "problem:submit",
    limit: 5,
    windowMs: 60000,
    message: "Submission rate limit exceeded. Please wait a moment before submitting again.",
});

export const contestRateLimiter = createRateLimiter({
    keyPrefix: "contest:get",
    limit: 30,
    windowMs: 60000,
    message: "Too many contest requests. Please try again later.",
});

export const analyticsRateLimiter = createRateLimiter({
    keyPrefix: "admin:analytics",
    limit: 10,
    windowMs: 60000,
    message: "Analytics rate limit exceeded. Please try again later.",
});

export const adminBulkRateLimiter = createRateLimiter({
    keyPrefix: "admin:bulk",
    limit: 10,
    windowMs: 60000,
    message: "Bulk operation rate limit exceeded. Please try again later.",
});

export const adminRateLimiter = createRateLimiter({
    keyPrefix: "admin:gen",
    limit: 60,
    windowMs: 60000,
    message: "Admin API rate limit exceeded. Please try again later.",
});

export const globalRateLimiter = createRateLimiter({
    keyPrefix: "global",
    limit: 200,
    windowMs: 60000,
});


// ─────────────────────────────────────────────
// 4. XSS Protection
// FIXED: No longer strips HTML from all fields — it now SKIPS known HTML-rich
// fields like description, editorial, code so their content is not destroyed.
// FIXED (BUG-12): Array items now inherit the parent key context so HTML_FIELDS
// check is not bypassed for array-type fields like starterCode.
// ─────────────────────────────────────────────
const HTML_FIELDS = new Set([
    "description", "editorial", "code", "code_body",
    "inputFormat", "outputFormat", "constraints", "notes",
    "starterCode", "driverCode", "payload", "source_code",
]);

function cleanXss(val: any, key?: string): any {
    // Skip HTML-rich fields — stripping tags breaks stored content
    if (key && HTML_FIELDS.has(key)) return val;

    if (typeof val === "string") {
        return val
            // Remove <script> blocks (including content)
            .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
            // Remove javascript: URI scheme
            .replace(/javascript\s*:/gi, "")
            // Remove data: URI scheme (used in onerror/src attacks)
            .replace(/data\s*:/gi, "")
            // Remove dangerous inline event handler attributes: onerror=, onload=, onclick=, etc.
            .replace(/\bon\w+\s*=\s*(['"]?)[\s\S]*?\1/gi, "")
            // Remove <iframe>, <object>, <embed>, <form> tags
            .replace(/<\/?(iframe|object|embed|form|base)[^>]*>/gi, "");
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
        for (const k in val) {
            val[k] = cleanXss(val[k], k);
        }
    } else if (Array.isArray(val)) {
        // BUG-12 FIX: Pass the parent key so HTML_FIELDS check applies inside arrays too
        return val.map((item) => cleanXss(item, key));
    }
    return val;
}

export function xssProtection(req: Request, res: Response, next: NextFunction) {
    req.body  = cleanXss(req.body);
    req.query = cleanXss(req.query);
    next();
}

// ─────────────────────────────────────────────
// 5. CSRF Protection via Origin/Referer validation
// BUG-17 FIX: Production domains now loaded from ALLOWED_ORIGINS env var.
// Format: comma-separated list of origin prefixes.
// Example: ALLOWED_ORIGINS=https://firecode.vercel.app,https://firecode.com
// ─────────────────────────────────────────────
const BASE_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5173",
];

// Load extra origins from env — supports Vercel, Render, Railway, custom domains
const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

export const ALLOWED_ORIGINS = [...BASE_ALLOWED_ORIGINS, ...envOrigins];

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }
    const origin  = req.headers.origin;
    const referer = req.headers.referer;

    if (origin && !ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
        return res.status(403).json({ success: false, message: "CSRF Blocked: Invalid Origin" });
    }
    if (referer && !ALLOWED_ORIGINS.some((o) => referer.startsWith(o))) {
        return res.status(403).json({ success: false, message: "CSRF Blocked: Invalid Referer" });
    }
    next();
}

// ─────────────────────────────────────────────
// 6. Admin Authorization Middleware
// Uses req.authUser (decoded JWT payload) for quick role check.
// Still hits DB to confirm the user exists and hasn't been demoted.
// ─────────────────────────────────────────────
export async function authorizeAdmin(
    req: AdminRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.authUser) {
        logger.security("ADMIN_AUTH_UNAUTHORIZED", { ip: req.ip });
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Quick role check from JWT — avoids DB hit for obvious non-admins
    if (req.authUser.role !== "admin") {
        metricsRegistry.recordSecurityEvent("ADMIN_ROLE_FORBIDDEN", { userId: req.authUser.id, role: req.authUser.role });
        logger.security("ADMIN_ROLE_FORBIDDEN", { userId: req.authUser.id, role: req.authUser.role });
        return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
    }

    try {
        // Confirm against DB in case role was changed, banned, or deleted since token was issued
        const user = await UserModel.findById(req.authUser.id).select("-password");
        if (!user || user.role !== "admin") {
            metricsRegistry.recordSecurityEvent("ADMIN_DB_VERIFY_FAILED", { userId: req.authUser.id });
            logger.security("ADMIN_DB_VERIFY_FAILED", { userId: req.authUser.id });
            return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
        }
        if (user.isDeleted) {
            logger.security("DEACTIVATED_ADMIN_ACCESS_ATTEMPT", { userId: req.authUser.id });
            return res.status(403).json({ success: false, message: "Forbidden: Account is deactivated" });
        }
        if (user.isBanned) {
            logger.security("BANNED_ADMIN_ACCESS_ATTEMPT", { userId: req.authUser.id });
            return res.status(403).json({ success: false, message: "Forbidden: Account is suspended" });
        }
        req.dbUser = user;
        next();
    } catch (e) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Re-export types for downstream use
export type { AdminRequest, AuthRequest };
