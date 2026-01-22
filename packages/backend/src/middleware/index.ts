import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { authService } from '../services/index.js';

// ==========================================
// Middleware
// ==========================================

// Extend Express request type
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
        }
    }
}

/**
 * Zod validation middleware factory
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
            const validated = schema.parse(data);

            // Replace the source with validated data
            if (source === 'body') req.body = validated;
            else if (source === 'query') req.query = validated as any;
            else req.params = validated as any;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));

                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors,
                });
                return;
            }
            next(error);
        }
    };
}

/**
 * Authentication middleware
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        const token = authHeader.substring(7);

        try {
            const payload = authService.verifyToken(token);
            req.userId = payload.userId;
            req.userEmail = payload.email;
            next();
        } catch {
            res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
            });
        }
    } catch (error) {
        next(error);
    }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const payload = authService.verifyToken(token);
                req.userId = payload.userId;
                req.userEmail = payload.email;
            } catch {
                // Token invalid, continue without auth
            }
        }

        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
