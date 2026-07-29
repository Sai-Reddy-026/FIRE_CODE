import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
    action: string;
    userId: mongoose.Types.ObjectId;
    username: string;
    details: string;
    ipAddress?: string;
    createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
    {
        action: { type: String, required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        username: { type: String, required: true },
        details: { type: String, required: true },
        ipAddress: { type: String },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
export default AuditLog;
