import { Response } from "express";
import { AdminService } from "../services/admin.service";
import { AdminRequest } from "../types/auth.types";

export class AdminController {
    static async generateOutputs(req: AdminRequest, res: Response): Promise<void> {
        const result = await AdminService.generateOutputsBatch(req.body);
        res.status(200).json({ success: true, ...result });
    }

    static async getProblems(req: AdminRequest, res: Response): Promise<void> {
        const problems = await AdminService.getProblems();
        res.status(200).json({ success: true, problems });
    }

    static async getProblemById(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const problem = await AdminService.getProblemById(id);
        res.status(200).json({ success: true, problem });
    }

    static async createProblem(req: AdminRequest, res: Response): Promise<void> {
        const problem = await AdminService.createProblem(req.body, req.dbUser, req.ip || "");
        res.status(201).json({ success: true, problem });
    }

    static async updateProblem(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const problem = await AdminService.updateProblem(id, req.body, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, problem });
    }

    static async deleteProblem(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        await AdminService.deleteProblem(id, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Problem soft-deleted successfully." });
    }

    static async duplicateProblem(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const duplicated = await AdminService.duplicateProblem(id, req.dbUser, req.ip || "");
        res.status(201).json({ success: true, problem: duplicated });
    }

    static async getTestCases(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const testcases = await AdminService.getTestCases(id);
        res.status(200).json({ success: true, testcases });
    }

    static async updateTestCases(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { testcases } = req.body;
        await AdminService.updateTestCases(id, testcases, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Test cases updated successfully." });
    }

    static async bulkDelete(req: AdminRequest, res: Response): Promise<void> {
        const { ids } = req.body;
        await AdminService.bulkDelete(ids, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Bulk delete completed." });
    }

    static async bulkPublish(req: AdminRequest, res: Response): Promise<void> {
        const { ids, status } = req.body;
        await AdminService.bulkPublish(ids, status, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Bulk status update completed." });
    }

    static async bulkDifficulty(req: AdminRequest, res: Response): Promise<void> {
        const { ids, difficulty } = req.body;
        await AdminService.bulkDifficulty(ids, difficulty, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Bulk difficulty update completed." });
    }

    static async bulkTags(req: AdminRequest, res: Response): Promise<void> {
        const { ids, tags, operation } = req.body;
        await AdminService.bulkTags(ids, tags, operation, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Bulk tags update completed." });
    }

    static async importProblems(req: AdminRequest, res: Response): Promise<void> {
        const message = await AdminService.importProblems(req.body, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message });
    }

    static async exportProblems(req: AdminRequest, res: Response): Promise<void> {
        const format = (req.query.format as string) || "json";
        const result = await AdminService.getExportData(format);
        res.setHeader("Content-Type", result.contentType);
        res.setHeader("Content-Disposition", `attachment; filename=${result.filename}`);
        res.send(result.data);
    }

    static async getDashboardStats(req: AdminRequest, res: Response): Promise<void> {
        const stats = await AdminService.getDashboardStats();
        res.status(200).json({ success: true, stats });
    }

    static async getUsers(req: AdminRequest, res: Response): Promise<void> {
        const { page, limit, search, role } = req.query;
        const result = await AdminService.getUsers({
            page: Number(page),
            limit: Number(limit),
            search: search as string,
            role: role as string,
        });
        res.status(200).json({ success: true, ...result });
    }

    static async getUserById(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await AdminService.getUserById(id);
        res.status(200).json({ success: true, ...result });
    }

    static async updateUserRole(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { role } = req.body;
        const user = await AdminService.updateUserRole(id, role, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "User role updated successfully", user });
    }

    static async deleteUser(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await AdminService.deleteAdminUser(id, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, ...result });
    }

    static async getContests(req: AdminRequest, res: Response): Promise<void> {
        const { page, limit, search, status } = req.query;
        const result = await AdminService.getContests({
            page: Number(page),
            limit: Number(limit),
            search: search as string,
            status: status as string,
        });
        res.status(200).json({ success: true, ...result });
    }

    static async getContestById(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const contest = await AdminService.getContestById(id);
        res.status(200).json({ success: true, contest });
    }

    static async createContest(req: AdminRequest, res: Response): Promise<void> {
        const contest = await AdminService.createContest(req.body, req.dbUser, req.ip || "");
        res.status(201).json({ success: true, contest });
    }

    static async updateContest(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const contest = await AdminService.updateContest(id, req.body, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, contest });
    }

    static async deleteContest(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await AdminService.deleteContest(id, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, ...result });
    }

    static async getAnalytics(req: AdminRequest, res: Response): Promise<void> {
        const analytics = await AdminService.getAnalyticsData();
        res.status(200).json({ success: true, analytics });
    }

    static async getAuditLogs(req: AdminRequest, res: Response): Promise<void> {
        const { page, limit, search, action } = req.query;
        const result = await AdminService.getAuditLogs({
            page: Number(page),
            limit: Number(limit),
            search: search as string,
            action: action as string,
        });
        res.status(200).json({ success: true, ...result });
    }

    static async getDashboardOverview(req: AdminRequest, res: Response): Promise<void> {
        const stats = await AdminService.getDashboardOverview();
        res.status(200).json({ success: true, stats });
    }

    static async setUserStatus(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { isBanned, reason } = req.body;
        const user = await AdminService.setUserStatus(id, isBanned, reason, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: `User ${isBanned ? "banned" : "unbanned"} successfully.`, user });
    }

    static async adjustUserPoints(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { amount, reason } = req.body;
        const user = await AdminService.adjustUserPoints(id, Number(amount), reason, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "User points updated successfully.", user });
    }

    static async getUserSubmissions(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const submissions = await AdminService.getUserSubmissions(id);
        res.status(200).json({ success: true, submissions });
    }

    static async getUserContests(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const contests = await AdminService.getUserContests(id);
        res.status(200).json({ success: true, contests });
    }

    static async getProblemAnalytics(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const analytics = await AdminService.getProblemAnalytics(id);
        res.status(200).json({ success: true, analytics });
    }

    static async updateProblemWorkflow(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { status } = req.body;
        const problem = await AdminService.updateProblemWorkflow(id, status, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: `Problem status updated to ${status}.`, problem });
    }

    static async updateProblemPoints(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { points } = req.body;
        const problem = await AdminService.updateProblemPoints(id, Number(points), req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Problem points updated successfully.", problem });
    }

    static async getContestParticipants(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await AdminService.getContestParticipants(id);
        res.status(200).json({ success: true, ...result });
    }

    static async getContestLeaderboard(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const result = await AdminService.getContestLeaderboard(id);
        res.status(200).json({ success: true, ...result });
    }

    static async freezeContestLeaderboard(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { isFrozen } = req.body;
        const contest = await AdminService.freezeContestLeaderboard(id, Boolean(isFrozen), req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: `Leaderboard ${isFrozen ? "frozen" : "unfrozen"} successfully.`, contest });
    }

    static async addContestAnnouncement(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { message } = req.body;
        const contest = await AdminService.addContestAnnouncement(id, message, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "Announcement added successfully.", contest });
    }

    static async getAllPointsTransactions(req: AdminRequest, res: Response): Promise<void> {
        const { page, limit } = req.query;
        const result = await AdminService.getAllPointsTransactions({ page: Number(page), limit: Number(limit) });
        res.status(200).json({ success: true, ...result });
    }

    static async rewardUser(req: AdminRequest, res: Response): Promise<void> {
        const { id } = req.params;
        const { points, type, reason } = req.body;
        const user = await AdminService.rewardUser(id, Number(points), type, reason, req.dbUser, req.ip || "");
        res.status(200).json({ success: true, message: "User points rewarded successfully.", user });
    }

    static async getAdvancedAnalytics(req: AdminRequest, res: Response): Promise<void> {
        const analytics = await AdminService.getAdvancedAnalytics();
        res.status(200).json({ success: true, analytics });
    }
}
