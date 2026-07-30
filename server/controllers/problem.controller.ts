import { Response } from "express";
import { ProblemService } from "../services/problem.service";
import { AuthRequest } from "../types/auth.types";
import { UnauthorizedError } from "../errors/AppError";
import { executeDirectSubmission } from "../utils/createTest";

export class ProblemController {
    static async runDirectCode(req: AuthRequest, res: Response): Promise<void> {
        const { source_code, language_id, stdin } = req.body;

        if (!source_code || typeof source_code !== "string" || source_code.trim().length === 0) {
            res.status(400).json({ success: false, message: "Submitted code cannot be empty." });
            return;
        }

        if (source_code.length > 50000) {
            res.status(400).json({ success: false, message: "Code exceeds maximum allowed size (50,000 characters)." });
            return;
        }

        const langIdNum = Number(language_id);
        const validLangIds = [50, 54, 62, 71, 63, 74, 60, 73, 51, 78];
        if (!language_id || isNaN(langIdNum) || !validLangIds.includes(langIdNum)) {
            res.status(400).json({
                success: false,
                message: "Valid language_id is required (50: C, 54: C++, 62: Java, 71: Python).",
            });
            return;
        }

        try {
            const data = await executeDirectSubmission(source_code, langIdNum, stdin || "");
            res.status(200).json(data);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Execution engine network failure.";
            res.status(503).json({
                success: false,
                message: `Judge0 execution failed: ${msg}`,
            });
        }
    }

    static async getActivity(req: AuthRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await ProblemService.getActivity(id);
        res.status(200).json(result);
    }

    static async getAllProblems(req: AuthRequest, res: Response): Promise<void> {
        const id = req.authUser?.id;
        if (!id) {
            throw new UnauthorizedError("Unauthorized");
        }

        const filters = {
            search: (req.query.search as string) || "",
            difficulty: (req.query.difficulty as string) || "",
            acceptance: (req.query.acceptance as string) || "",
            title: (req.query.title as string) || "",
        };

        const result = await ProblemService.getAllProblems(id, filters);
        res.status(200).json(result);
    }

    static async getProblem(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const id = req.authUser?.id || "";
        const result = await ProblemService.getProblem(name, id);
        res.status(200).json(result);
    }

    static async getEditorial(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const id = req.authUser?.id || "";
        const result = await ProblemService.getEditorial(name, id);
        res.status(200).json(result);
    }

    static async runCode(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const { code } = req.body;
        if (code && typeof code === "string" && code.length > 50000) {
            res.status(400).json({ success: false, message: "Code exceeds maximum allowed size (50,000 characters)." });
            return;
        }
        const result = await ProblemService.runCode(name, req.body);
        res.status(200).json(result);
    }

    static async submitCode(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const id = req.authUser?.id || "";
        const { code } = req.body;
        if (code && typeof code === "string" && code.length > 50000) {
            res.status(400).json({ success: false, message: "Code exceeds maximum allowed size (50,000 characters)." });
            return;
        }
        const result = await ProblemService.submitCode(name, id, req.body);
        res.status(200).json(result);
    }

    static async getSubmissions(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const id = req.authUser?.id || "";
        const result = await ProblemService.getSubmissions(name, id);
        res.status(200).json(result);
    }

    static async getAdjacent(req: AuthRequest, res: Response): Promise<void> {
        const { name } = req.params;
        const result = await ProblemService.getAdjacent(name);
        res.status(200).json(result);
    }
}
