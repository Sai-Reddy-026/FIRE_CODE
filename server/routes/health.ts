import express from "express";
import { HealthController } from "../controllers/health.controller";
import { asyncHandler } from "../middlewares/error";

const healthRouter = express.Router();

healthRouter.get("/", asyncHandler(HealthController.getHealth) as express.RequestHandler);
healthRouter.get("/metrics", asyncHandler(HealthController.getMetrics) as express.RequestHandler);

export default healthRouter;
