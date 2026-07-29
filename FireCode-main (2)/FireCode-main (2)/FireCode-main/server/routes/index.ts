import express from "express";
import problem from "./problem";
import accounts from "./accounts";
import contests from "./contests";
import admin from "./admin";

import UserModel from "../models/user.model";
import cacheService from "../services/cache.service";
import { asyncHandler } from "../middlewares/error";

const router = express.Router();

router.use("/problem", problem);
router.use("/accounts", accounts);
router.use("/contests", contests);
router.use("/admin", admin);

// Public leaderboard — cached for 2 minutes to avoid a full collection scan per request.
// No authentication required; results are already public-safe (no emails/tokens).
router.get("/leaderboard", asyncHandler(async (req: express.Request, res: express.Response) => {
    const CACHE_KEY = "leaderboard:top100";
    const cached = await cacheService.get(CACHE_KEY);
    if (cached) {
        return res.status(200).json(cached);
    }

    const users = await UserModel.find({ isDeleted: { $ne: true } })
        .sort({ points: -1 })
        .limit(100)
        .select("username avatar_url points problems_solved_count role rating")
        .lean();

    const mappedUsers = users.map((u, idx) => ({
        username: u.username,
        avatar: u.avatar_url || null,
        points: u.points || 0,
        solvedProblems: u.problems_solved_count || 0,
        role: u.role || "user",
        rating: u.rating || 1500,
        rank: idx + 1
    }));

    const response = { success: true, users: mappedUsers };
    await cacheService.set(CACHE_KEY, response, 120); // 2-minute TTL
    res.status(200).json(response);
}) as express.RequestHandler);

export default router;
