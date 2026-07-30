import { NextFunction, Request, Response } from "express";
import { ALLOWED_ORIGINS } from "./security";

/**
 * Custom CORS middleware.
 *
 * FIXED: The previous implementation set Access-Control-Allow-Origin: *
 * combined with Access-Control-Allow-Credentials: true — this is INVALID
 * per the CORS spec and rejected by all modern browsers.
 *
 * Fix: Dynamically reflect the request Origin back only if it's in the
 * whitelist, so credentials (Authorization header) work correctly.
 */
export function customCors(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    const isAllowed =
        !origin ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com") ||
        ALLOWED_ORIGINS.some((o) => origin.startsWith(o));

    if (origin && isAllowed) {
        // Reflect the exact origin back so credentials work
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
        // Non-browser client (Postman, curl, server-to-server)
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    // If origin is set but not in whitelist, no Allow-Origin header is set — browser blocks it

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, Accept, Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    next();
}
