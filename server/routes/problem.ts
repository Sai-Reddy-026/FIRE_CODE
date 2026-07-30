import express from "express";
import { ProblemController } from "../controllers/problem.controller";
import { authenticateToken } from "../middlewares/token";
import { runCodeRateLimiter, submitCodeRateLimiter } from "../middlewares/security";
import { asyncHandler } from "../middlewares/error";

const problem = express.Router();

// Secure all endpoints under /api/problem with JWT verification
problem.use(authenticateToken as express.RequestHandler);

problem.get("/activity/:id", asyncHandler(ProblemController.getActivity) as express.RequestHandler);
problem.get("/user/submissions", asyncHandler(ProblemController.getUserSubmissions) as express.RequestHandler);
problem.get("/all", asyncHandler(ProblemController.getAllProblems) as express.RequestHandler);
problem.post("/run/:name", runCodeRateLimiter as express.RequestHandler, asyncHandler(ProblemController.runCode) as express.RequestHandler);
problem.post("/submit/:name", submitCodeRateLimiter as express.RequestHandler, asyncHandler(ProblemController.submitCode) as express.RequestHandler);
problem.get("/submissions/:name", asyncHandler(ProblemController.getSubmissions) as express.RequestHandler);
problem.get("/adjacent/:name", asyncHandler(ProblemController.getAdjacent) as express.RequestHandler);
problem.get("/:name/editorial", asyncHandler(ProblemController.getEditorial) as express.RequestHandler);
problem.get("/:name", asyncHandler(ProblemController.getProblem) as express.RequestHandler);

export default problem;
