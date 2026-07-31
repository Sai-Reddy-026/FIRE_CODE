import mongoose, { Schema, Document } from "mongoose";

export interface IStarterCode {
    language: string;
    code: string;
}

export interface IExample {
    input: string;
    output: string;
    explanation?: string;
}

export interface IProblem extends Document {
    problemId: number;
    title: string;
    slug: string;
    difficulty: "easy" | "medium" | "hard";
    category?: string;
    tags: string[];
    description: string;
    constraints?: string;
    inputFormat?: string;
    outputFormat?: string;
    notes?: string;
    hints: string[];
    editorial?: string;
    officialSolution?: {
        language: string;
        code: string;
    };
    examples: IExample[];
    starterCode: IStarterCode[];
    languageVersion: Record<string, string>;
    timeLimit: number; // in milliseconds
    memoryLimit: number; // in megabytes
    points: number;
    acceptanceRate: number; // percentage (0 - 100)
    submissionCount: number;
    successCount: number;
    status: "draft" | "pending_review" | "published" | "archived";
    version: number;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const exampleSchema = new Schema<IExample>({
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String },
});

const starterCodeSchema = new Schema<IStarterCode>({
    language: { type: String, required: true },
    code: { type: String, required: true },
});

const problemSchema = new Schema<IProblem>(
    {
        problemId: { type: Number, required: true, unique: true, index: true },
        title: { type: String, required: true },
        slug: { type: String, required: true, unique: true, index: true },
        difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
        category: { type: String },
        tags: { type: [String], default: [], index: true },
        description: { type: String, required: true },
        constraints: { type: String },
        inputFormat: { type: String },
        outputFormat: { type: String },
        notes: { type: String },
        hints: { type: [String], default: [] },
        editorial: { type: String },
        officialSolution: {
            language: { type: String },
            code: { type: String }
        },
        examples: { type: [exampleSchema], default: [] },
        starterCode: { type: [starterCodeSchema], default: [] },
        languageVersion: { type: Map, of: String, default: {} },
        timeLimit: { type: Number, default: 2000, min: [0, "timeLimit cannot be negative"] },
        memoryLimit: { type: Number, default: 256, min: [0, "memoryLimit cannot be negative"] },
        points: { type: Number, default: 0, min: [0, "points cannot be negative"] },
        acceptanceRate: { type: Number, default: 0, min: [0, "acceptanceRate cannot be less than 0"], max: [100, "acceptanceRate cannot exceed 100"] },
        submissionCount: { type: Number, default: 0, min: [0, "submissionCount cannot be negative"] },
        successCount: { type: Number, default: 0, min: [0, "successCount cannot be negative"] },
        status: { type: String, enum: ["draft", "pending_review", "published", "archived"], default: "draft", index: true },
        version: { type: Number, default: 1 },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
        isDeleted: { type: Boolean, default: false, index: true },
    },
    {
        timestamps: true,
    }
);

problemSchema.index({ category: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ isDeleted: 1, status: 1, difficulty: 1 });
problemSchema.index({ isDeleted: 1, status: 1, tags: 1 });

const Problem = mongoose.model<IProblem>("ProblemNew", problemSchema);
export default Problem;
