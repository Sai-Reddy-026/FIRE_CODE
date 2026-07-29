import { Response } from "express";
import { ProblemService } from "../services/problem.service";
import { AuthRequest } from "../types/auth.types";
import { UnauthorizedError } from "../errors/AppError";

export class ProblemController {
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
