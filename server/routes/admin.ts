import express from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticateToken } from "../middlewares/token";
import { authorizeAdmin, adminRateLimiter, analyticsRateLimiter, adminBulkRateLimiter } from "../middlewares/security";
import { asyncHandler } from "../middlewares/error";
import {
    validateCreateProblem,
    validateUpdateProblem,
    validateBulkOperation,
    validateBulkPublish,
    validateBulkDifficulty,
    validateBulkTags
} from "../middlewares/validation";

const admin = express.Router();

// Apply auth + rate limiter + admin authorization to ALL admin endpoints
admin.use(authenticateToken as express.RequestHandler);
admin.use(adminRateLimiter as express.RequestHandler);
admin.use(authorizeAdmin as express.RequestHandler);

// ─────────────────────────────────────────────────────────────────
// Dashboard Stats, Analytics & Audit Logs
// (Place specific subpaths like /analytics/advanced before /analytics)
// ─────────────────────────────────────────────────────────────────
admin.get("/dashboard-stats", analyticsRateLimiter as express.RequestHandler, asyncHandler(AdminController.getDashboardStats) as express.RequestHandler);
admin.get("/dashboard-overview", analyticsRateLimiter as express.RequestHandler, asyncHandler(AdminController.getDashboardOverview) as express.RequestHandler);
admin.get("/analytics/advanced", analyticsRateLimiter as express.RequestHandler, asyncHandler(AdminController.getAdvancedAnalytics) as express.RequestHandler);
admin.get("/analytics", analyticsRateLimiter as express.RequestHandler, asyncHandler(AdminController.getAnalytics) as express.RequestHandler);
admin.get("/audit-logs", asyncHandler(AdminController.getAuditLogs) as express.RequestHandler);

// ─────────────────────────────────────────────────────────────────
// Bulk Problem Operations & Code Generation
// ─────────────────────────────────────────────────────────────────
admin.get("/problems/export", adminBulkRateLimiter as express.RequestHandler, asyncHandler(AdminController.exportProblems) as express.RequestHandler);
admin.post("/problems/import", adminBulkRateLimiter as express.RequestHandler, asyncHandler(AdminController.importProblems) as express.RequestHandler);

admin.post(
    "/problems/bulk-delete",
    adminBulkRateLimiter as express.RequestHandler,
    validateBulkOperation as express.RequestHandler,
    asyncHandler(AdminController.bulkDelete) as express.RequestHandler
);

admin.post(
    "/problems/bulk-publish",
    adminBulkRateLimiter as express.RequestHandler,
    validateBulkOperation as express.RequestHandler,
    validateBulkPublish as express.RequestHandler,
    asyncHandler(AdminController.bulkPublish) as express.RequestHandler
);

admin.post(
    "/problems/bulk-difficulty",
    adminBulkRateLimiter as express.RequestHandler,
    validateBulkOperation as express.RequestHandler,
    validateBulkDifficulty as express.RequestHandler,
    asyncHandler(AdminController.bulkDifficulty) as express.RequestHandler
);

admin.post(
    "/problems/bulk-tags",
    adminBulkRateLimiter as express.RequestHandler,
    validateBulkOperation as express.RequestHandler,
    validateBulkTags as express.RequestHandler,
    asyncHandler(AdminController.bulkTags) as express.RequestHandler
);

admin.post("/generate-outputs", asyncHandler(AdminController.generateOutputs) as express.RequestHandler);

// ─────────────────────────────────────────────────────────────────
// Problem Management CRUD & Sub-resource Endpoints
// (Subpaths like /problems/:id/analytics must come BEFORE /problems/:id)
// ─────────────────────────────────────────────────────────────────
admin.get("/problems", asyncHandler(AdminController.getProblems) as express.RequestHandler);

admin.post(
    "/problems",
    validateCreateProblem as express.RequestHandler,
    asyncHandler(AdminController.createProblem) as express.RequestHandler
);

// Problem sub-resource routes
admin.get("/problems/:id/analytics", analyticsRateLimiter as express.RequestHandler, asyncHandler(AdminController.getProblemAnalytics) as express.RequestHandler);
admin.patch("/problems/:id/workflow", asyncHandler(AdminController.updateProblemWorkflow) as express.RequestHandler);
admin.patch("/problems/:id/points", asyncHandler(AdminController.updateProblemPoints) as express.RequestHandler);
admin.post("/problems/:id/duplicate", asyncHandler(AdminController.duplicateProblem) as express.RequestHandler);
admin.get("/problems/:id/testcases", asyncHandler(AdminController.getTestCases) as express.RequestHandler);
admin.post("/problems/:id/testcases", asyncHandler(AdminController.updateTestCases) as express.RequestHandler);

// Generic problem by ID routes
admin.get("/problems/:id", asyncHandler(AdminController.getProblemById) as express.RequestHandler);

admin.patch(
    "/problems/:id",
    validateUpdateProblem as express.RequestHandler,
    asyncHandler(AdminController.updateProblem) as express.RequestHandler
);

admin.delete("/problems/:id", asyncHandler(AdminController.deleteProblem) as express.RequestHandler);

// ─────────────────────────────────────────────────────────────────
// User Administration Endpoints
// (Subpaths like /users/:id/role must come BEFORE /users/:id)
// ─────────────────────────────────────────────────────────────────
admin.get("/users", asyncHandler(AdminController.getUsers) as express.RequestHandler);

// User sub-resource routes
admin.patch("/users/:id/role", asyncHandler(AdminController.updateUserRole) as express.RequestHandler);
admin.patch("/users/:id/status", asyncHandler(AdminController.setUserStatus) as express.RequestHandler);
admin.post("/users/:id/points", asyncHandler(AdminController.adjustUserPoints) as express.RequestHandler);
admin.post("/users/:id/reward", asyncHandler(AdminController.rewardUser) as express.RequestHandler);
admin.get("/users/:id/submissions", asyncHandler(AdminController.getUserSubmissions) as express.RequestHandler);
admin.get("/users/:id/contests", asyncHandler(AdminController.getUserContests) as express.RequestHandler);

// Generic user by ID routes
admin.get("/users/:id", asyncHandler(AdminController.getUserById) as express.RequestHandler);
admin.delete("/users/:id", asyncHandler(AdminController.deleteUser) as express.RequestHandler);

// Points Management
admin.get("/points/transactions", asyncHandler(AdminController.getAllPointsTransactions) as express.RequestHandler);

// ─────────────────────────────────────────────────────────────────
// Contest Administration Endpoints
// (Subpaths like /contests/:id/participants must come BEFORE /contests/:id)
// ─────────────────────────────────────────────────────────────────
admin.get("/contests", asyncHandler(AdminController.getContests) as express.RequestHandler);
admin.post("/contests", asyncHandler(AdminController.createContest) as express.RequestHandler);

// Contest sub-resource routes
admin.get("/contests/:id/participants", asyncHandler(AdminController.getContestParticipants) as express.RequestHandler);
admin.get("/contests/:id/leaderboard", asyncHandler(AdminController.getContestLeaderboard) as express.RequestHandler);
admin.patch("/contests/:id/freeze", asyncHandler(AdminController.freezeContestLeaderboard) as express.RequestHandler);
admin.post("/contests/:id/announcement", asyncHandler(AdminController.addContestAnnouncement) as express.RequestHandler);

// Generic contest by ID routes
admin.get("/contests/:id", asyncHandler(AdminController.getContestById) as express.RequestHandler);
admin.patch("/contests/:id", asyncHandler(AdminController.updateContest) as express.RequestHandler);
admin.delete("/contests/:id", asyncHandler(AdminController.deleteContest) as express.RequestHandler);

export default admin;
