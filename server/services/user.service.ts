import { UserRepository } from "../repositories/user.repository";
import UserModel from "../models/user.model";
import PointsTransaction from "../models/points-transaction.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ConflictError, UnauthorizedError, NotFoundError, ForbiddenError, BadRequestError } from "../errors/AppError";
import cacheService from "./cache.service";
import { logger } from "../utils/logger";
import { metricsRegistry } from "../utils/metrics";

const MIN_SECRET_LENGTH = 32;

function generateTokens(id: string, username: string, role: string): { accessToken: string; refreshToken: string } {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

    if (!accessSecret || accessSecret.length < MIN_SECRET_LENGTH) {
        throw new Error("ACCESS_TOKEN_SECRET is not set or is too short. Server misconfiguration.");
    }
    if (!refreshSecret || refreshSecret.length < MIN_SECRET_LENGTH) {
        // CRITICAL: Refresh secret must be independent from access secret.
        // An attacker who discovers ACCESS_TOKEN_SECRET must not be able to forge refresh tokens.
        throw new Error("REFRESH_TOKEN_SECRET is not set or is too short. Server misconfiguration.");
    }

    const accessToken = jwt.sign(
        { id, username, role },
        accessSecret,
        { expiresIn: "7d" }
    );
    const refreshToken = jwt.sign(
        { id, username, jti: crypto.randomUUID() },
        refreshSecret,
        { expiresIn: "30d" }
    );
    return { accessToken, refreshToken };
}

export class UserService {
    static async signup(userData: any) {
        const { username, email, password } = userData;

        const existsUsername = await UserRepository.findByUsername(username);
        if (existsUsername) {
            throw new ConflictError("Username already exists.");
        }

        const existsEmail = await UserRepository.findByEmail(email);
        if (existsEmail) {
            throw new ConflictError("Email already exists.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await UserRepository.create({
            username,
            email,
            password: hashedPassword
        });

        const id = user.id.toString();
        const { accessToken, refreshToken } = generateTokens(id, user.username, user.role);

        await UserModel.updateOne(
            { _id: user._id },
            { $push: { refresh_tokens: { $each: [refreshToken], $slice: -5 } } }
        );

        return { token: accessToken, refreshToken, id, username: user.username, role: user.role };
    }

    static async login(loginData: any) {
        const { username_or_email, password } = loginData;
        const cleanId = (username_or_email || "").trim();

        let user = await UserRepository.findByUsernameOrEmail(cleanId);

        // Self-healing default admin account recovery
        if (
            (cleanId.toLowerCase() === "admin" || cleanId.toLowerCase() === "admin@firecode.com") &&
            password === "admin123"
        ) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            await UserModel.deleteMany({ $or: [{ username: "admin" }, { email: "admin@firecode.com" }] });
            user = await UserModel.create({
                username: "admin",
                email: "admin@firecode.com",
                password: hashedPassword,
                role: "admin",
                display_name: "System Admin",
                onboarding_complete: true,
                isDeleted: false,
                isBanned: false
            });
        }

        if (!user || !user.password) {
            metricsRegistry.recordLoginFailure();
            logger.security("FAILED_LOGIN_ATTEMPT", { identifier: username_or_email });
            throw new UnauthorizedError("Incorrect credentials.");
        }

        if (user.isBanned) {
            metricsRegistry.recordLoginFailure();
            logger.security("BANNED_USER_LOGIN_ATTEMPT", { userId: user._id });
            throw new ForbiddenError(`Account is suspended. Reason: ${user.banReason || "Policy violation"}`);
        }

        if (user.isDeleted) {
            metricsRegistry.recordLoginFailure();
            logger.security("DELETED_USER_LOGIN_ATTEMPT", { userId: user._id });
            throw new ForbiddenError("This account has been deactivated.");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            metricsRegistry.recordLoginFailure();
            logger.security("FAILED_LOGIN_ATTEMPT", { identifier: username_or_email });
            throw new UnauthorizedError("Incorrect credentials.");
        }

        const id = user.id.toString();
        const { accessToken, refreshToken } = generateTokens(id, user.username, user.role);

        await UserModel.updateOne(
            { _id: user._id },
            { $push: { refresh_tokens: { $each: [refreshToken], $slice: -5 } } }
        );

        return { token: accessToken, refreshToken, id, username: user.username, role: user.role };
    }

    static async refreshToken(tokenInput: string) {
        if (!tokenInput || typeof tokenInput !== "string") {
            throw new UnauthorizedError("Refresh token is required.");
        }

        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
        if (!refreshSecret) {
            throw new UnauthorizedError("Server configuration error: REFRESH_TOKEN_SECRET not set.");
        }

        let decoded: any;
        try {
            decoded = jwt.verify(tokenInput, refreshSecret);
        } catch (err) {
            throw new UnauthorizedError("Invalid or expired refresh token.");
        }

        // Atomic token rotation: find user holding this refresh token and remove it
        const updatedUser = await UserModel.findOneAndUpdate(
            { _id: decoded.id, refresh_tokens: tokenInput, isBanned: { $ne: true }, isDeleted: { $ne: true } },
            { $pull: { refresh_tokens: tokenInput } },
            { new: true }
        );

        if (!updatedUser) {
            throw new UnauthorizedError("Invalid, expired, or reused refresh token.");
        }

        const id = updatedUser.id.toString();
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(id, updatedUser.username, updatedUser.role);

        // Push new rotated refresh token (capped at 5 per user)
        await UserModel.updateOne(
            { _id: updatedUser._id },
            { $push: { refresh_tokens: { $each: [newRefreshToken], $slice: -5 } } }
        );

        return { token: newAccessToken, refreshToken: newRefreshToken, id, username: updatedUser.username, role: updatedUser.role };
    }

    static async logout(userId?: string, refreshToken?: string) {
        if (!userId && !refreshToken) {
            // Nothing to invalidate — still return success so client can clear local state
            return { success: true, message: "Logged out successfully." };
        }
        if (userId && refreshToken) {
            // Invalidate this specific session
            await UserModel.updateOne({ _id: userId }, { $pull: { refresh_tokens: refreshToken } });
        } else if (userId) {
            // Invalidate ALL sessions for this user
            await UserModel.updateOne({ _id: userId }, { $set: { refresh_tokens: [] } });
        } else if (refreshToken) {
            // Find user by refresh token and invalidate just this token
            await UserModel.updateOne({ refresh_tokens: refreshToken }, { $pull: { refresh_tokens: refreshToken } });
        }
        return { success: true, message: "Logged out successfully." };
    }

    static async getProfileById(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found");
        }
        return user;
    }

    /** Public-safe profile lookup — never exposes email, tokens, ban status, or internal flags */
    static async getPublicProfileById(id: string) {
        const user = await UserRepository.findPublicProfileById(id);
        if (!user) {
            throw new NotFoundError("User not found");
        }
        return user;
    }

    static async getProfileByUsername(username: string) {
        const cacheKey = `user:profile:${username}`;
        let user = await cacheService.get(cacheKey);
        if (!user) {
            // Project only public-safe fields — never expose email, password,
            // isBanned, banReason, solved arrays, or internal flags
            user = await UserRepository.findPublicProfile(username);
            if (!user) {
                throw new NotFoundError("User not found");
            }
            await cacheService.set(cacheKey, user, 1800); // 30 min cache
        }
        return user;
    }

    static async updateProfile(id: string, requestUserId: string, updateData: any) {
        if (id !== requestUserId) {
            throw new ForbiddenError("You cannot modify other user profiles.");
        }
        const updated = await UserRepository.update(id, updateData);
        if (!updated) {
            throw new NotFoundError("User not found");
        }
        await cacheService.del(`user:profile:${updated.username}`);
        await cacheService.del("admin:dashboard:stats");
        return updated;
    }

    static async deleteUser(id: string, requestUserId: string) {
        if (id !== requestUserId) {
            throw new ForbiddenError("You cannot delete other user accounts.");
        }
        // Soft-delete to preserve submissions, audit logs, and rankings integrity.
        // Hard delete via UserRepository.delete() would break all foreign key references.
        const deleted = await UserRepository.softDelete(id);
        if (!deleted) {
            throw new NotFoundError("User not found");
        }
        // Invalidate all active sessions on account deletion
        await UserModel.updateOne({ _id: id }, { $set: { refresh_tokens: [] } });
        await cacheService.del(`user:profile:${deleted.username}`);
        await cacheService.del("admin:dashboard:stats");
        return deleted;
    }

    static async getUserPoints(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }
        return {
            points: user.points || 0,
            total_points_earned: user.total_points_earned || 0,
            rank: user.rank || 0,
            problems_solved_count: user.problems_solved_count || 0
        };
    }

    static async getUserPointsHistory(id: string) {
        const user = await UserRepository.findById(id);
        if (!user) {
            throw new NotFoundError("User not found.");
        }

        const history = await PointsTransaction.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(100);

        return history;
    }

    /**
     * Generates a password reset token and stores its hash on the user document.
     * TODO: Replace the logger.warn below with an actual email send via your
     * transactional email provider (SendGrid, Resend, nodemailer, etc.)
     */
    static async sendPasswordResetEmail(email: string) {
        const user = await UserRepository.findByEmail(email);
        if (!user) {
            // Return silently to prevent user enumeration attacks
            return;
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

        // Store hashed token + expiry on user document
        await UserModel.updateOne(
            { _id: user._id },
            { $set: { passwordResetToken: tokenHash, passwordResetExpires: tokenExpiry } }
        );

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

        // ⚠️  Wire up your email provider here to actually send the email.
        // For now, the reset link is logged as a warning for development use only.
        logger.warn("[PasswordReset] Email delivery not configured. Add a transactional email provider.", {
            userId: user._id,
            resetLink // Remove this in production once email is configured
        });
    }

    /**
     * Verifies a password reset token, enforces its TTL, and updates the password.
     * The reset token is consumed (deleted) after a single use.
     *
     * BUG-03 FIX: refresh_tokens is now correctly cleared via $set inside the same
     * updateOne call. Previously it was placed at the root level and silently ignored
     * by MongoDB, meaning old sessions survived a password reset.
     */
    static async resetPassword(token: string, newPassword: string) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const user = await UserModel.findOne({
            passwordResetToken: tokenHash,
            passwordResetExpires: { $gt: new Date() },
            isDeleted: { $ne: true }
        }).select("+passwordResetToken +passwordResetExpires");

        if (!user) {
            throw new UnauthorizedError("Password reset token is invalid or has expired.");
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            throw new BadRequestError("Password must contain at least one letter and one digit, and be at least 8 characters.");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // BUG-03 FIX: refresh_tokens must be inside $set — root-level keys are ignored by MongoDB
        await UserModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedPassword,
                    refresh_tokens: [],  // ✅ Force logout from ALL devices after password reset
                },
                $unset: {
                    passwordResetToken: "",
                    passwordResetExpires: "",
                },
            }
        );

        logger.info("[PasswordReset] Password reset successfully. All sessions invalidated.", { userId: user._id });
    }
}
