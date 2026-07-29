import { Request, Response } from "express";
import { ContestService } from "../services/contest.service";

export class ContestController {
    static async getAll(req: Request, res: Response): Promise<void> {
        const list = await ContestService.getAllContests();
        res.status(200).json(list);
    }

    static async getUpcoming(req: Request, res: Response): Promise<void> {
        const list = await ContestService.getUpcomingContests();
        res.status(200).json(list);
    }

    static async getLive(req: Request, res: Response): Promise<void> {
        const list = await ContestService.getLiveContests();
        res.status(200).json(list);
    }

    static async getPast(req: Request, res: Response): Promise<void> {
        const list = await ContestService.getPastContests();
        res.status(200).json(list);
    }

    static async getBySlug(req: Request, res: Response): Promise<void> {
        const { slug } = req.params;
        const contest = await ContestService.getContestBySlug(slug);
        res.status(200).json(contest);
    }
}
