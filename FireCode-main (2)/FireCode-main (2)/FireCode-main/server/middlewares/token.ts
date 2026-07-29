import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../types/auth.types";
// Note: dotenv is loaded once at startup in server.ts — no need to re-call it here

/**
 * Middleware: verify JWT and attach the decoded payload to req.authUser.
 *
 * HTTP Semantics (RFC 7235):
 *   401 Unauthorized → token missing, invalid, or expired (authentication failure)
 *   403 Forbidden    → valid token, but insufficient permissions (authorization failure)
 *
 * FIXED: Previously returned 403 for expired/invalid tokens.
 *        Now correctly returns 401 so the frontend can trigger silent token refresh.
 */
export function authenticateToken(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers["authorization"];
    // Accept both "Bearer <token>" (RFC 7617) and raw token (legacy)
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    if (!token) {
        return res
            .status(401)
            .json({ success: false, message: "Authentication required. No token provided." });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, (err, decoded) => {
        if (err) {
            // Distinguish expired tokens from truly invalid ones for better client-side UX
            const isExpired = err.name === "TokenExpiredError";
            return res.status(401).json({
                success: false,
                message: isExpired
                    ? "Session expired. Please refresh your token."
                    : "Invalid token. Please log in again.",
            });
        }
        // decoded is the structured { id, username, role } object we sign
        req.authUser = decoded as AuthPayload;
        next();
    });
}
