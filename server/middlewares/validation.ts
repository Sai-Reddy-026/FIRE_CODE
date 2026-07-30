import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors/AppError";
import Filter from "bad-words";
import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────────────
// Shared enum constants — single source of truth.
// These MUST match the Mongoose schema enums in problem.model.ts.
// ─────────────────────────────────────────────────────────────────

/** All valid problem difficulty levels (matches problem.model.ts) */
export const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

/**
 * All valid problem statuses (matches problem.model.ts).
 * BUG-05/BUG-06 FIX: "pending_review" was missing — now included.
 */
export const VALID_STATUSES = ["draft", "pending_review", "published", "archived"] as const;

export type ProblemDifficulty = typeof VALID_DIFFICULTIES[number];
export type ProblemStatus = typeof VALID_STATUSES[number];

// ─────────────────────────────────────────────────────────────────
// Auth Validators
// ─────────────────────────────────────────────────────────────────

export const validateSignup = (req: Request, res: Response, next: NextFunction): void => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return next(new BadRequestError("Missing required fields."));
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    // BUG-22 FIX: Message now says "3–20 characters" to match the regex /^[a-zA-Z0-9_-]{3,20}$/
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;

    if (!emailRegex.test(email)) {
        return next(new BadRequestError("Email is not valid."));
    }
    if (!passwordRegex.test(password)) {
        return next(new BadRequestError("Password must contain at least one letter and one digit, and be at least 8 characters."));
    }
    if (!usernameRegex.test(username)) {
        // BUG-22 FIX: Was "3–15 characters" — corrected to "3–20 characters"
        return next(new BadRequestError("Username must be 3–20 characters: letters, numbers, hyphens, or underscores."));
    }

    const filter = new Filter();
    if (filter.isProfane(username)) {
        return next(new BadRequestError("Username contains inappropriate language."));
    }

    next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
    const { username_or_email, password } = req.body;

    if (!username_or_email || !password) {
        return next(new BadRequestError("Missing required fields"));
    }

    next();
};

// ─────────────────────────────────────────────────────────────────
// Problem Validators
// ─────────────────────────────────────────────────────────────────

export const validateCreateProblem = (req: Request, res: Response, next: NextFunction): void => {
    const { problemId, title, slug, difficulty, status } = req.body;

    if (!problemId || !title || !slug || !difficulty) {
        return next(new BadRequestError("Missing required fields: problemId, title, slug, difficulty."));
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
        return next(new BadRequestError("Slug must be lowercase, numbers, and hyphens only (e.g. 'two-sum')."));
    }

    if (!(VALID_DIFFICULTIES as readonly string[]).includes(difficulty)) {
        return next(new BadRequestError(`Difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}.`));
    }

    // BUG-05 FIX: "pending_review" is now a valid status
    if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
        return next(new BadRequestError(`Status must be one of: ${VALID_STATUSES.join(", ")}.`));
    }

    next();
};

/** Partial update validator — only validates fields that are present in the request body */
export const validateUpdateProblem = (req: Request, res: Response, next: NextFunction): void => {
    const { slug, difficulty, status } = req.body;

    if (slug !== undefined) {
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
            return next(new BadRequestError("Slug must be lowercase, numbers, and hyphens only (e.g. 'two-sum')."));
        }
    }

    if (difficulty !== undefined && !(VALID_DIFFICULTIES as readonly string[]).includes(difficulty)) {
        return next(new BadRequestError(`Difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}.`));
    }

    // BUG-05 FIX: "pending_review" is now a valid status
    if (status !== undefined && !(VALID_STATUSES as readonly string[]).includes(status)) {
        return next(new BadRequestError(`Status must be one of: ${VALID_STATUSES.join(", ")}.`));
    }

    next();
};

/** @deprecated Use validateCreateProblem or validateUpdateProblem instead */
export const validateProblemPayload = validateCreateProblem;

// ─────────────────────────────────────────────────────────────────
// Bulk Operation Validators
// ─────────────────────────────────────────────────────────────────

export const validateBulkOperation = (req: Request, res: Response, next: NextFunction): void => {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return next(new BadRequestError("Missing or invalid 'ids' array."));
    }

    for (const id of ids) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return next(new BadRequestError(`Invalid ObjectId in ids list: ${id}`));
        }
    }

    next();
};

export const validateBulkDifficulty = (req: Request, res: Response, next: NextFunction): void => {
    const { difficulty } = req.body;

    if (!difficulty || !(VALID_DIFFICULTIES as readonly string[]).includes(difficulty)) {
        return next(new BadRequestError(`Difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}.`));
    }

    next();
};

export const validateBulkPublish = (req: Request, res: Response, next: NextFunction): void => {
    const { status } = req.body;

    // BUG-15 FIX: "pending_review" is now a valid status for bulk operations too
    if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
        return next(new BadRequestError(`Status must be one of: ${VALID_STATUSES.join(", ")}.`));
    }

    next();
};

export const validateBulkTags = (req: Request, res: Response, next: NextFunction): void => {
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
        return next(new BadRequestError("Missing or invalid 'tags' array."));
    }

    next();
};
