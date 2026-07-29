import mongoose, { Schema, Document } from "mongoose";

export interface ITestCase extends Document {
    problemId: mongoose.Types.ObjectId;
    input: string;
    expectedOutput: string;
    explanation?: string;
    executionOrder: number;
    weight: number;
    timeLimit?: number; // optional limit override in milliseconds
    memoryLimit?: number; // optional limit override in megabytes
    isHidden: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const testCaseSchema = new Schema<ITestCase>(
    {
        problemId: { type: Schema.Types.ObjectId, ref: "ProblemNew", required: true, index: true },
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        explanation: { type: String },
        executionOrder: { type: Number, default: 0 },
        weight: { type: Number, default: 1 },
        timeLimit: { type: Number },
        memoryLimit: { type: Number },
        isHidden: { type: Boolean, default: false, index: true },
        isDeleted: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

testCaseSchema.index({ problemId: 1, isHidden: 1, isDeleted: 1 });
testCaseSchema.index({ problemId: 1, isDeleted: 1, executionOrder: 1 });

const TestCase = mongoose.model<ITestCase>("TestCase", testCaseSchema);
export default TestCase;
