import { UserRepository } from "../repositories/user.repository";
import UserModel from "../models/user.model";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UnauthorizedError, ForbiddenError } from "../errors/AppError";

// In-memory stores for state validation and one-time exchange codes
const stateStore = new Map<string, { provider: string; expires: number }>();

/**
 * BUG-04 FIX: exchangeCodeStore now stores refreshToken in addition to accessToken.
 * OAuth users previously never received a refreshToken — they would be permanently
 * logged out after 7 days with no way to silently refresh their session.
 */
const exchangeCodeStore = new Map<string, {
    data: {
        token: string;
        refreshToken: string;
        id: string;
        username: string;
        role: "user" | "admin";
    };
    expires: number;
}>();

// Periodic cleanup of expired states and codes.
// Skipped in test environments to avoid process hang.
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of stateStore.entries()) {
      if (v.expires < now) stateStore.delete(k);
    }
    for (const [k, v] of exchangeCodeStore.entries()) {
      if (v.expires < now) exchangeCodeStore.delete(k);
    }
  }, 300000);
}

/** Generate access + refresh tokens for an OAuth user and persist the refresh token in DB */
async function generateAndPersistOAuthTokens(
    userId: string,
    username: string,
    role: "user" | "admin"
): Promise<{ token: string; refreshToken: string }> {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

    if (!accessSecret) throw new Error("ACCESS_TOKEN_SECRET is not configured.");
    if (!refreshSecret) throw new Error("REFRESH_TOKEN_SECRET is not configured.");

    const token = jwt.sign(
        { id: userId, username, role },
        accessSecret,
        { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
        { id: userId, username, jti: crypto.randomUUID() },
        refreshSecret,
        { expiresIn: "30d" }
    );

    // BUG-04 FIX: Persist refresh token in DB so it can be rotated/invalidated
    await UserModel.updateOne(
        { _id: userId },
        { $push: { refresh_tokens: { $each: [refreshToken], $slice: -5 } } }
    );

    return { token, refreshToken };
}

export class OAuthService {
  static generateState(provider: "google" | "github"): string {
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, { provider, expires: Date.now() + 600000 }); // 10 min TTL
    return state;
  }

  static validateState(state: string, provider: "google" | "github"): boolean {
    const record = stateStore.get(state);
    if (!record) return false;
    stateStore.delete(state); // One-time state consumption
    if (record.provider !== provider || record.expires < Date.now()) {
      return false;
    }
    return true;
  }

  static createOneTimeCode(sessionData: {
      token: string;
      refreshToken: string;
      id: string;
      username: string;
      role: "user" | "admin";
  }): string {
    const code = crypto.randomBytes(24).toString("hex");
    exchangeCodeStore.set(code, { data: sessionData, expires: Date.now() + 60000 }); // 60s TTL
    return code;
  }

  static exchangeCode(code: string) {
    const record = exchangeCodeStore.get(code);
    if (!record) {
      throw new UnauthorizedError("Invalid or expired OAuth exchange code.");
    }
    exchangeCodeStore.delete(code); // One-time consumption
    if (record.expires < Date.now()) {
      throw new UnauthorizedError("OAuth exchange code has expired.");
    }
    return record.data;
  }

  static getGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:80/api/accounts/auth/google/callback";
    const state = this.generateState("google");
    const scope = encodeURIComponent("openid email profile");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scope}&state=${state}`;
  }

  static async handleGoogleCallback(code: string, state: string) {
    if (!state || !this.validateState(state, "google")) {
      throw new UnauthorizedError("Invalid or expired OAuth state parameter (CSRF protection).");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:80/api/accounts/auth/google/callback";

    // 1. Exchange authorization code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json() as any;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedError(tokenData.error_description || "Google authorization token exchange failed.");
    }

    // 2. Fetch user profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json() as any;
    if (!userRes.ok || !googleUser.email) {
      throw new UnauthorizedError("Could not retrieve profile from Google.");
    }

    // Require verified email address
    if (googleUser.verified_email === false || googleUser.email_verified === false) {
      throw new UnauthorizedError("Your Google email address is not verified. Please verify your Google email address first.");
    }

    const { id: googleId, email, name, picture } = googleUser;

    // 3. Find existing user by email
    let user = await UserRepository.findByEmail(email);

    if (!user) {
      let baseUsername = (name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
      baseUsername = baseUsername.slice(0, 15);

      let username = baseUsername;
      let counter = 1;
      while (await UserRepository.findByUsername(username)) {
        username = `${baseUsername.slice(0, 10)}_${counter}`;
        counter++;
      }

      user = await UserRepository.create({
        username,
        email,
        display_name: name || username,
        avatar_url: picture || "",
        provider: "google",
        providerId: googleId,
        onboarding_complete: true,
      });
    } else {
      if (user.isDeleted) {
        throw new ForbiddenError("Your account has been deactivated.");
      }
      if (user.isBanned) {
        throw new ForbiddenError(`Account is suspended. Reason: ${user.banReason || "Policy violation"}`);
      }

      // Safely link provider info to existing verified email account
      user.provider = "google";
      user.providerId = googleId;
      if (picture && !user.avatar_url) user.avatar_url = picture;
      await user.save();
    }

    // 4. BUG-04 FIX: Generate BOTH access token AND refresh token for OAuth users
    const userId = user._id.toString();
    const { token, refreshToken } = await generateAndPersistOAuthTokens(userId, user.username, user.role);

    return { token, refreshToken, id: userId, username: user.username, role: user.role };
  }

  static getGithubAuthUrl(): string {
    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || "http://localhost:80/api/accounts/auth/github/callback";
    const state = this.generateState("github");
    const scope = encodeURIComponent("user:email");
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&state=${state}`;
  }

  static async handleGithubCallback(code: string, state: string) {
    if (!state || !this.validateState(state, "github")) {
      throw new UnauthorizedError("Invalid or expired OAuth state parameter (CSRF protection).");
    }

    const clientId = process.env.GITHUB_CLIENT_ID || "";
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || "http://localhost:80/api/accounts/auth/github/callback";

    // 1. Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json() as any;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedError(tokenData.error_description || "GitHub authorization token exchange failed.");
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch user profile
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "FireCode-App",
      },
    });

    const githubUser = await userRes.json() as any;
    if (!userRes.ok || !githubUser.id) {
      throw new UnauthorizedError("Could not retrieve GitHub profile.");
    }

    let email = githubUser.email;
    let isEmailVerified = Boolean(email);

    // Fetch primary verified email from /user/emails
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "FireCode-App",
      },
    });
    if (emailRes.ok) {
      const emails = await emailRes.json() as any[];
      if (Array.isArray(emails)) {
        const verifiedPrimary = emails.find((e: any) => e.primary && e.verified);
        const verifiedAny = emails.find((e: any) => e.verified);
        if (verifiedPrimary) {
          email = verifiedPrimary.email;
          isEmailVerified = true;
        } else if (verifiedAny) {
          email = verifiedAny.email;
          isEmailVerified = true;
        } else {
          isEmailVerified = false;
        }
      }
    }

    if (!email || !isEmailVerified) {
      throw new UnauthorizedError("Your GitHub email address is not verified. Please verify your email on GitHub first.");
    }

    const githubId = githubUser.id.toString();

    // 3. Find existing user by email
    let user = await UserRepository.findByEmail(email);

    if (!user) {
      let baseUsername = githubUser.login.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (baseUsername.length < 3) baseUsername = `gh_${baseUsername}`;
      baseUsername = baseUsername.slice(0, 15);

      let username = baseUsername;
      let counter = 1;
      while (await UserRepository.findByUsername(username)) {
        username = `${baseUsername.slice(0, 10)}_${counter}`;
        counter++;
      }

      user = await UserRepository.create({
        username,
        email,
        display_name: githubUser.name || githubUser.login,
        avatar_url: githubUser.avatar_url || "",
        github: githubUser.login,
        provider: "github",
        providerId: githubId,
        onboarding_complete: true,
      });
    } else {
      if (user.isDeleted) {
        throw new ForbiddenError("Your account has been deactivated.");
      }
      if (user.isBanned) {
        throw new ForbiddenError(`Account is suspended. Reason: ${user.banReason || "Policy violation"}`);
      }

      // Link provider info cleanly to existing user record
      user.provider = "github";
      user.providerId = githubId;
      if (githubUser.avatar_url && !user.avatar_url) user.avatar_url = githubUser.avatar_url;
      if (githubUser.login && !user.github) user.github = githubUser.login;
      await user.save();
    }

    // 4. BUG-04 FIX: Generate BOTH access token AND refresh token for OAuth users
    const userId = user._id.toString();
    const { token, refreshToken } = await generateAndPersistOAuthTokens(userId, user.username, user.role);

    return { token, refreshToken, id: userId, username: user.username, role: user.role };
  }
}
