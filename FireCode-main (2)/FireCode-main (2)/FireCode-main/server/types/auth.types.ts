import { Request } from "express";

/**
 * Structured JWT payload embedded in every signed token.
 * Role is included so authorizeAdmin does NOT need an extra DB round-trip
 * just to check the role — but it still verifies against DB for freshness.
 */
export interface AuthPayload {
    id: string;
    username: string;
    role: "user" | "admin";
    iat?: number;
    exp?: number;
}

/**
 * Express Request extended with the decoded JWT payload.
 * Used by authenticateToken and all downstream middlewares.
 */
export interface AuthRequest extends Request {
    authUser?: AuthPayload;
}

/**
 * Admin-specific request — guaranteed to have both the JWT payload
 * and the full Mongoose user document (set by authorizeAdmin).
 */
export interface AdminRequest extends AuthRequest {
    dbUser?: any;
}
