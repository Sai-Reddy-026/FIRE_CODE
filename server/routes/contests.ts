import express from "express";
import { ContestController } from "../controllers/contest.controller";
import { contestRateLimiter } from "../middlewares/security";
import { asyncHandler } from "../middlewares/error";

const contests = express.Router();

contests.use(contestRateLimiter as express.RequestHandler);

contests.get("/", asyncHandler(ContestController.getAll) as express.RequestHandler);
contests.get("/upcoming", asyncHandler(ContestController.getUpcoming) as express.RequestHandler);
contests.get("/live", asyncHandler(ContestController.getLive) as express.RequestHandler);
contests.get("/past", asyncHandler(ContestController.getPast) as express.RequestHandler);
contests.get("/:slug", asyncHandler(ContestController.getBySlug) as express.RequestHandler);

export default contests;
