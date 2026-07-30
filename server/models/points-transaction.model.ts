import mongoose, { Schema, Document } from "mongoose";

export interface IPointsTransaction extends Document {
    userId: mongoose.Types.ObjectId;
    points: number;
    type: "problem_solved" | "contest_reward" | "manual_adjustment" | "bonus";
    reason: string;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const pointsTransactionSchema = new Schema<IPointsTransaction>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        points: { type: Number, required: true },
        type: {
            type: String,
            enum: ["problem_solved", "contest_reward", "manual_adjustment", "bonus"],
            default: "problem_solved",
            index: true,
        },
        reason: { type: String, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

pointsTransactionSchema.index({ createdAt: -1 });

const PointsTransaction = mongoose.model<IPointsTransaction>("PointsTransaction", pointsTransactionSchema);
export default PointsTransaction;
