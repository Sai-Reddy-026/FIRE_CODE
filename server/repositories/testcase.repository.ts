import mongoose from "mongoose";
import TestCaseModel from "../models/testcase.model";

export class TestCaseRepository {
    static async findByProblemId(problemId: string | mongoose.Types.ObjectId, options: { isDeleted?: boolean } = {}) {
        const idObj = typeof problemId === "string" && mongoose.Types.ObjectId.isValid(problemId)
            ? new mongoose.Types.ObjectId(problemId)
            : problemId;
        const query: any = { $or: [{ problemId: problemId }, { problemId: idObj }] };
        if (options.isDeleted !== undefined) query.isDeleted = options.isDeleted;
        return TestCaseModel.find(query);
    }

    static async softDeleteByProblemId(problemId: string) {
        return TestCaseModel.updateMany({ problemId }, { $set: { isDeleted: true } });
    }

    static async insertMany(testcases: any[]) {
        return TestCaseModel.insertMany(testcases);
    }
}
