import mongoose, { Document } from "mongoose";

export interface IAnnouncement {
    message: string;
    createdAt: Date;
}

export interface DContest extends Document {
    id: number;
    title: string;
    slug: string;
    description: string;
    type: "weekly" | "biweekly" | "virtual" | "special";
    status: "upcoming" | "live" | "past";
    start_time: Date;
    end_time: Date;
    duration_minutes: number;
    problems: string[]; // array of problem names/slugs
    participants_count: number;
    registration_open: boolean;
    isFrozen?: boolean;
    announcements?: IAnnouncement[];
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const announcementSchema = new mongoose.Schema<IAnnouncement>({
    message:   { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const contestSchema = new mongoose.Schema<DContest>({
    id:                  { type: Number, required: true, unique: true },
    title:               { type: String, required: true },
    slug:                { type: String, required: true, unique: true },
    description:         { type: String, default: "" },
    type:                { type: String, enum: ["weekly", "biweekly", "virtual", "special"], default: "weekly" },
    status:              { type: String, enum: ["upcoming", "live", "past"], default: "upcoming" },
    start_time:          { type: Date, required: true },
    end_time:            { 
        type: Date, 
        required: true,
        validate: {
            validator: function(this: any, val: Date) {
                return val > this.start_time;
            },
            message: "end_time must be greater than start_time"
        }
    },
    duration_minutes:    { type: Number, default: 90 },
    problems:            { type: [String], default: [] },
    participants_count:  { type: Number, default: 0 },
    registration_open:   { type: Boolean, default: true },
    isFrozen:            { type: Boolean, default: false },
    announcements:       { type: [announcementSchema], default: [] },
    isDeleted:           { type: Boolean, default: false, index: true },
}, {
    timestamps: true,
});

contestSchema.index({ slug: 1 });
contestSchema.index({ start_time: -1 });
contestSchema.index({ end_time: -1 });
contestSchema.index({ start_time: 1, end_time: 1 });

const ContestModel = mongoose.model<DContest>("Contest", contestSchema);

export default ContestModel;
