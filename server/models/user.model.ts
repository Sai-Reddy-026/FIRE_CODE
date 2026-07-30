import mongoose, { Document } from "mongoose";

export interface DUser extends Document {
    // Core auth
    username: string;
    email: string;
    password?: string;
    provider?: "local" | "google" | "github";
    providerId?: string;

    // Submissions & problems
    problems_starred: string[];
    problems_solved: string[];
    problems_attempted: string[];
    problems_solved_count: number;
    problems_solved_easy: number;
    problems_solved_medium: number;
    problems_solved_hard: number;
    problems_attempted_count: number;

    // Rewards & Gamification
    points: number;
    total_points_earned: number;

    // Platform stats
    rank: number;
    rating: number;
    views: number;
    solution_count: number;
    reputation_count: number;

    // Activity tracking
    solved_dates: string[];
    longest_streak: number;

    // Extended profile
    display_name: string;
    bio: string;
    location: string;
    company: string;
    website: string;
    github: string;
    linkedin: string;
    twitter: string;
    country: string;
    avatar_url: string;
    skills: string[];
    languages: string[];
    education: {
        school: string;
        degree: string;
        field: string;
        graduation_year: string;
    };

    // Preferences
    preferred_language: string;
    theme: string;

    // Onboarding & security
    onboarding_complete: boolean;
    role: "user" | "admin";
    refresh_tokens?: string[];
    isBanned?: boolean;
    banReason?: string;
    isDeleted?: boolean;

    // Password reset — stored as sha256 hash, never the raw token
    passwordResetToken?: string;
    passwordResetExpires?: Date;

    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new mongoose.Schema<DUser>({
    username:              { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        match: [/^[a-zA-Z0-9_-]{3,20}$/, "Username must be 3–20 characters: letters, numbers, hyphens, or underscores"]
    },
    email:                 { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Please fill a valid email address"]
    },
    password:              { type: String, required: false, default: "" },
    provider:              { type: String, enum: ["local", "google", "github"], default: "local" },
    providerId:            { type: String, default: "" },

    problems_starred:      { type: [String], default: [] },
    problems_solved:       { type: [String], default: [] },
    problems_attempted:    { type: [String], default: [] },
    problems_solved_count: { type: Number, default: 0 },
    problems_solved_easy:  { type: Number, default: 0 },
    problems_solved_medium:{ type: Number, default: 0 },
    problems_solved_hard:  { type: Number, default: 0 },
    problems_attempted_count:{ type: Number, default: 0 },

    points:                { type: Number, default: 0 },
    total_points_earned:   { type: Number, default: 0 },

    rank:                  { type: Number, default: 0 },
    rating:                { type: Number, default: 1500 },
    views:                 { type: Number, default: 0 },
    solution_count:        { type: Number, default: 0 },
    reputation_count:      { type: Number, default: 0 },
    solved_dates:          { type: [String], default: [] },
    longest_streak:        { type: Number, default: 0 },

    // Extended profile fields
    display_name:          { type: String, default: "" },
    bio:                   { type: String, default: "" },
    location:              { type: String, default: "" },
    company:               { type: String, default: "" },
    website:               { type: String, default: "" },
    github:                { type: String, default: "" },
    linkedin:              { type: String, default: "" },
    twitter:               { type: String, default: "" },
    country:               { type: String, default: "" },
    avatar_url:            { type: String, default: "" },
    skills:                { type: [String], default: [] },
    languages:             { type: [String], default: [] },
    education: {
        school:          { type: String, default: "" },
        degree:          { type: String, default: "" },
        field:           { type: String, default: "" },
        graduation_year: { type: String, default: "" },
    },
    preferred_language:    { type: String, default: "javascript" },
    theme:                 { type: String, default: "dark" },
    onboarding_complete:   { type: Boolean, default: false },

    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
        index: true,
    },
    refresh_tokens: { type: [String], default: [] },
    isBanned:  { type: Boolean, default: false, index: true },
    banReason: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },

    // Password reset (token is stored as sha256 hash — never the raw token)
    passwordResetToken:   { type: String, select: false },
    passwordResetExpires: { type: Date,   select: false },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

userSchema.index({ points: -1, total_points_earned: -1 });
userSchema.index({ isDeleted: 1, points: -1 });
userSchema.index({ isDeleted: 1, createdAt: -1 });

const UserModel = mongoose.model<DUser>("User", userSchema);

export default UserModel;
