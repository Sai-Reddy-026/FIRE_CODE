export class AppError extends Error {
    constructor(public statusCode: number, public message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = "Bad Request") {
        super(400, message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "Unauthorized") {
        super(401, message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "Forbidden") {
        super(403, message);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = "Not Found") {
        super(404, message);
    }
}

export class ConflictError extends AppError {
    constructor(message: string = "Conflict") {
        super(409, message);
    }
}
