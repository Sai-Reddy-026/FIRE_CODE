import mongoose, { Schema, Document } from "mongoose";

/**
 * Standalone Submission document — each accepted or attempted code
 * submission is stored here instead of inside the User document array.
 *
 * This prevents the User document from hitting MongoDB's 16 MB limit
 * and allows efficient aggregation queries for the admin dashboard.
 */
export interface ISubmission extends Document {
    userId: mongoose.Types.ObjectId;
    username: string;
    problemId: mongoose.Types.ObjectId;
    problemSlug: string;
    problemTitle: string;
    status: string;           // "Accepted" | "Wrong Answer" | "Runtime Error" | etc.
    language: string;
    code: string;
    runtime: number;          // milliseconds
    memory: number;           // megabytes (already divided)
    error?: string;
    input?: string;
    expected_output?: string;
    user_output?: string;
    testCasesPassed?: number;
    totalTestCases?: number;
    submittedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
    {
        userId:        { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        username:      { type: String, required: true, index: true },
        problemId:     { type: Schema.Types.ObjectId, ref: "ProblemNew", required: true, index: true },
        problemSlug:   { type: String, required: true, index: true },
        problemTitle:  { type: String, required: true },
        status:        { type: String, required: true, index: true },
        language:      { type: String, required: true, index: true },
        code:          { type: String, required: true, maxlength: 50000, select: false },
        runtime:       { type: Number, default: 0 },
        memory:        { type: Number, default: 0 },
        error:         { type: String },
        input:         { type: String },
        expected_output: { type: String },
        user_output:   { type: String },
        testCasesPassed: { type: Number, default: 0 },
        totalTestCases:  { type: Number, default: 0 },
        submittedAt:   { type: Date, default: Date.now, index: true },
    },
    {
        // No updatedAt needed — submissions are immutable records
        timestamps: { createdAt: false, updatedAt: false },
    }
);

// Compound indexes for high-frequency query patterns & leaderboard aggregations
submissionSchema.index({ userId: 1, submittedAt: -1 });
submissionSchema.index({ userId: 1, problemSlug: 1, submittedAt: -1 });
submissionSchema.index({ problemId: 1, status: 1, runtime: 1 });
submissionSchema.index({ problemSlug: 1, submittedAt: 1, status: 1 });
submissionSchema.index({ submittedAt: -1 });
submissionSchema.index({ language: 1, submittedAt: -1 });

const SubmissionModel = mongoose.model<ISubmission>("Submission", submissionSchema);
export default SubmissionModel;
