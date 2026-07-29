import express from "express";
import { UserController } from "../controllers/user.controller";
import { authenticateToken } from "../middlewares/token";
import {
    loginRateLimiter,
    signupRateLimiter,
    oauthRateLimiter,
    refreshRateLimiter,
    forgotPasswordRateLimiter,
} from "../middlewares/security";
import { validateSignup, validateLogin } from "../middlewares/validation";
import { asyncHandler } from "../middlewares/error";

const accounts = express.Router();

accounts.post(
    "/signup",
    signupRateLimiter as express.RequestHandler,
    validateSignup as express.RequestHandler,
    asyncHandler(UserController.signup) as express.RequestHandler
);

accounts.post(
    "/login",
    loginRateLimiter as express.RequestHandler,
    validateLogin as express.RequestHandler,
    asyncHandler(UserController.login) as express.RequestHandler
);

// BUG-07 FIX: Use dedicated refreshRateLimiter (IP-only, not email-keyed).
accounts.post(
    "/refresh",
    refreshRateLimiter as express.RequestHandler,
    asyncHandler(UserController.refreshToken) as express.RequestHandler
);

accounts.post(
    "/logout",
    authenticateToken as express.RequestHandler,
    asyncHandler(UserController.logout) as express.RequestHandler
);

accounts.post(
    "/forgot-password",
    forgotPasswordRateLimiter as express.RequestHandler,
    asyncHandler(UserController.forgotPassword) as express.RequestHandler
);

accounts.post(
    "/reset-password",
    loginRateLimiter as express.RequestHandler,
    asyncHandler(UserController.resetPassword) as express.RequestHandler
);

// OAuth Endpoints
accounts.get("/auth/google", oauthRateLimiter as express.RequestHandler, asyncHandler(UserController.googleAuth) as express.RequestHandler);
accounts.get("/auth/google/callback", asyncHandler(UserController.googleCallback) as express.RequestHandler);
accounts.get("/auth/github", oauthRateLimiter as express.RequestHandler, asyncHandler(UserController.githubAuth) as express.RequestHandler);
accounts.get("/auth/github/callback", asyncHandler(UserController.githubCallback) as express.RequestHandler);
accounts.post("/auth/exchange", oauthRateLimiter as express.RequestHandler, asyncHandler(UserController.exchangeOAuthCode) as express.RequestHandler);

accounts.delete(
    "/delete/:id",
    authenticateToken as express.RequestHandler,
    asyncHandler(UserController.deleteUser) as express.RequestHandler
);

accounts.patch(
    "/profile/:id",
    authenticateToken as express.RequestHandler,
    asyncHandler(UserController.updateProfile) as express.RequestHandler
);

accounts.get(
    "/id/:id",
    asyncHandler(UserController.getProfileById) as express.RequestHandler
);

// Subpaths must come before generic parameter matches
accounts.get(
    "/:id/points/history",
    asyncHandler(UserController.getUserPointsHistory) as express.RequestHandler
);

accounts.get(
    "/:id/points",
    asyncHandler(UserController.getUserPoints) as express.RequestHandler
);

// Note: /:username must remain last — it is a catch-all wildcard.
// Routes above with specific segments (/:id/points, /id/:id) take priority.
accounts.get(
    "/:username",
    asyncHandler(UserController.getProfileByUsername) as express.RequestHandler
);

export default accounts;
