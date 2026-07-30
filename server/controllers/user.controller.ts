import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { OAuthService } from "../services/oauth.service";
import { AuthRequest } from "../types/auth.types";

export class UserController {
    static async signup(req: Request, res: Response): Promise<void> {
        const result = await UserService.signup(req.body);
        res.status(201).json({
            success: true,
            message: "Account created successfully",
            ...result
        });
    }

    static async login(req: Request, res: Response): Promise<void> {
        const result = await UserService.login(req.body);
        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            ...result
        });
    }
    
    static async refreshToken(req: Request, res: Response): Promise<void> {
        const refreshToken = req.body?.refreshToken || req.headers["x-refresh-token"];
        const result = await UserService.refreshToken(refreshToken);
        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            ...result
        });
    }

    static async logout(req: AuthRequest, res: Response): Promise<void> {
        const userId = req.authUser?.id;
        const refreshToken = req.body?.refreshToken;
        const result = await UserService.logout(userId, refreshToken);
        res.status(200).json(result);
    }

    static async googleAuth(req: Request, res: Response): Promise<void> {
        const url = OAuthService.getGoogleAuthUrl();
        res.redirect(url);
    }

    static async googleCallback(req: Request, res: Response): Promise<void> {
        const { code, state } = req.query;
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        try {
            if (!code || typeof code !== "string" || !state || typeof state !== "string") {
                throw new Error("Missing authorization code or state parameter");
            }
            const sessionData = await OAuthService.handleGoogleCallback(code, state);
            const tempCode = OAuthService.createOneTimeCode(sessionData);
            res.redirect(`${frontendUrl}/auth/callback?code=${tempCode}`);
        } catch (err: any) {
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(err.message || "Google authentication failed")}`);
        }
    }

    static async githubAuth(req: Request, res: Response): Promise<void> {
        const url = OAuthService.getGithubAuthUrl();
        res.redirect(url);
    }

    static async githubCallback(req: Request, res: Response): Promise<void> {
        const { code, state } = req.query;
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        try {
            if (!code || typeof code !== "string" || !state || typeof state !== "string") {
                throw new Error("Missing authorization code or state parameter");
            }
            const sessionData = await OAuthService.handleGithubCallback(code, state);
            const tempCode = OAuthService.createOneTimeCode(sessionData);
            res.redirect(`${frontendUrl}/auth/callback?code=${tempCode}`);
        } catch (err: any) {
            res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(err.message || "GitHub authentication failed")}`);
        }
    }

    static async exchangeOAuthCode(req: Request, res: Response): Promise<void> {
        const { code } = req.body;
        if (!code || typeof code !== "string") {
            throw new Error("Missing exchange code");
        }
        const sessionData = OAuthService.exchangeCode(code);
        res.status(200).json({
            success: true,
            ...sessionData  // includes token, refreshToken, id, username, role
        });
    }

    static async getProfileById(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        // Use public-safe projection — never expose email, refresh_tokens, ban status, etc.
        const profile = await UserService.getPublicProfileById(id);
        res.status(200).json(profile);
    }

    static async getProfileByUsername(req: Request, res: Response): Promise<void> {
        const { username } = req.params;
        const profile = await UserService.getProfileByUsername(username);
        res.status(200).json(profile);
    }

    static async updateProfile(req: AuthRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const requestUserId = req.authUser?.id || "";
        const updated = await UserService.updateProfile(id, requestUserId, req.body);
        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updated
        });
    }

    static async deleteUser(req: AuthRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const requestUserId = req.authUser?.id || "";
        await UserService.deleteUser(id, requestUserId);
        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    }

    static async getUserPoints(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await UserService.getUserPoints(id);
        res.status(200).json({
            success: true,
            ...result
        });
    }

    static async getUserPointsHistory(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        const history = await UserService.getUserPointsHistory(id);
        res.status(200).json({ success: true, history });
    }

    static async forgotPassword(req: Request, res: Response): Promise<void> {
        const { email } = req.body;
        if (!email || typeof email !== "string") {
            res.status(400).json({ success: false, message: "Email is required." });
            return;
        }
        // Always respond with success regardless of whether email exists — prevents user enumeration
        await UserService.sendPasswordResetEmail(email);
        res.status(200).json({
            success: true,
            message: "If an account with that email exists, a password reset link has been sent."
        });
    }

    static async resetPassword(req: Request, res: Response): Promise<void> {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            res.status(400).json({ success: false, message: "Token and new password are required." });
            return;
        }
        await UserService.resetPassword(token, newPassword);
        res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
    }
}
