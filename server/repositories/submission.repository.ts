import SubmissionModel from "../models/submission.model";

export class SubmissionRepository {
    static async findByUserAndProblem(userId: string, problemSlug: string) {
        return SubmissionModel.find({ userId, problemSlug }).sort({ submittedAt: -1 });
    }

    static async create(submissionData: any) {
        const submission = new SubmissionModel(submissionData);
        return submission.save();
    }

    static async countSubmissions() {
        return SubmissionModel.countDocuments();
    }

    static async countSuccessSubmissions() {
        return SubmissionModel.countDocuments({ status: "Accepted" });
    }

    static async aggregateStats() {
        return SubmissionModel.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);
    }

    static async aggregateRecentSubmissions(limit: number = 5) {
        return SubmissionModel.find()
            .sort({ submittedAt: -1 })
            .limit(limit)
            .populate("userId", "username")
            .populate("problemId", "title slug");
    }
}
