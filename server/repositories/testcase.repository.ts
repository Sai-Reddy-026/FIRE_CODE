import TestCaseModel from "../models/testcase.model";

export class TestCaseRepository {
    static async findByProblemId(problemId: string, options: { isDeleted?: boolean } = {}) {
        const query: any = { problemId };
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
