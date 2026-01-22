import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

// ==========================================
// Error Handling Middleware
// ==========================================

/**
 * Custom error class with status code
 */
export class AppError extends Error {
    statusCode: number;
    code: string;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

/**
 * Authentication error
 */
export class AuthError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401, 'AUTH_ERROR');
    }
}

/**
 * Authorization error
 */
export class ForbiddenError extends AppError {
    constructor(message: string = 'Access denied') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT');
    }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
    constructor(message: string = 'Service temporarily unavailable') {
        super(message, 503, 'SERVICE_UNAVAILABLE');
    }
}

/**
 * Disk space error
 */
export class DiskSpaceError extends AppError {
    constructor() {
        super('Insufficient disk space', 507, 'DISK_SPACE');
    }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
    err: Error | AppError,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    // Log error
    console.error('❌ Error:', err.message);

    if (config.nodeEnv === 'development') {
        console.error(err.stack);
    }

    // Handle known errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(config.nodeEnv === 'development' && { stack: err.stack }),
        });
        return;
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
        });
        return;
    }

    // Handle Mongoose cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        res.status(400).json({
            success: false,
            error: 'Invalid ID format',
            code: 'INVALID_ID',
        });
        return;
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
        });
        return;
    }

    if (err.name === 'TokenExpiredError') {
        res.status(401).json({
            success: false,
            error: 'Token expired',
            code: 'TOKEN_EXPIRED',
        });
        return;
    }

    // Unknown errors
    const statusCode = 500;
    const message =
        config.nodeEnv === 'production' ? 'Internal server error' : err.message;

    res.status(statusCode).json({
        success: false,
        error: message,
        code: 'INTERNAL_ERROR',
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
}

/**
 * Catch async errors wrapper
 */
export function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch(next);
    };
}
