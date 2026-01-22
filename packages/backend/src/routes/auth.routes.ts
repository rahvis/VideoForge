import { Router, type IRouter } from 'express';
import { validate, asyncHandler } from '../middleware/index.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/index.js';
import { authService } from '../services/index.js';

// ==========================================
// Auth Routes
// ==========================================

const router: IRouter = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post(
    '/register',
    validate(registerSchema),
    asyncHandler(async (req, res) => {
        const { email, password, name } = req.body;

        try {
            const result = await authService.register(email, password, name);

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: {
                    user: result.user,
                    accessToken: result.accessToken,
                    expiresIn: result.expiresIn,
                },
            });
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                res.status(409).json({
                    success: false,
                    error: error.message,
                });
                return;
            }
            throw error;
        }
    })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
    '/login',
    validate(loginSchema),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        try {
            const result = await authService.login(email, password);

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: result.user,
                    accessToken: result.accessToken,
                    expiresIn: result.expiresIn,
                },
            });
        } catch (error: any) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    })
);

/**
 * POST /api/auth/refresh
 * Refresh token
 */
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    asyncHandler(async (req, res) => {
        const { token } = req.body;

        try {
            const result = await authService.refreshToken(token);

            res.json({
                success: true,
                data: {
                    accessToken: result.accessToken,
                    expiresIn: result.expiresIn,
                },
            });
        } catch (error: any) {
            res.status(401).json({
                success: false,
                error: error.message,
            });
        }
    })
);

export default router;
