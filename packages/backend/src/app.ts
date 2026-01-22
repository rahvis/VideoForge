import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import routes from './routes/index.js';

// Create Express application
const app: Application = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

// ==========================================
// RATE LIMITING
// ==========================================

// General API rate limit: 1000 requests per 15 minutes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
    },
});

// Strict rate limit for auth endpoints: 10 requests per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.',
    },
});

// Video creation rate limit: 5 per hour
const videoCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Video creation limit reached. Please try again later.',
    },
});

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api/videos/create', videoCreationLimiter);
app.use('/api', generalLimiter);

// ==========================================
// STATIC FILE SERVING
// ==========================================

app.use('/uploads', express.static(path.resolve(config.uploadDir), {
    setHeaders: (res, filePath) => {
        // Enable range requests for video files
        if (filePath.endsWith('.mp4')) {
            res.set('Accept-Ranges', 'bytes');
            res.set('Content-Type', 'video/mp4');
        }
        if (filePath.endsWith('.mp3')) {
            res.set('Content-Type', 'audio/mpeg');
        }
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.set('Content-Type', 'image/jpeg');
        }
    },
}));

// ==========================================
// HEALTH CHECK ENDPOINT
// ==========================================

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
    });
});

// ==========================================
// API ROUTES
// ==========================================

app.get('/api', (_req: Request, res: Response) => {
    res.status(200).json({
        name: 'VideoForge API',
        version: '1.0.0',
        description: 'AI-powered video creation platform (60-120s videos)',
        endpoints: {
            health: '/health',
            system: {
                status: 'GET /api/system/status',
                lock: 'GET /api/system/lock',
                health: 'GET /api/system/health',
            },
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                refresh: 'POST /api/auth/refresh',
            },
            prompts: {
                enhance: 'POST /api/prompts/enhance',
                decompose: 'POST /api/prompts/decompose',
            },
            videos: {
                create: 'POST /api/videos/create',
                list: 'GET /api/videos',
                get: 'GET /api/videos/:id',
                status: 'GET /api/videos/:id/status',
                segments: 'GET /api/videos/:id/segments',
                update: 'PATCH /api/videos/:id',
                cancel: 'POST /api/videos/:id/cancel',
                delete: 'DELETE /api/videos/:id',
            },
            files: {
                video: 'GET /api/files/:id/video',
                audio: 'GET /api/files/:id/audio',
                thumbnail: 'GET /api/files/:id/thumbnail',
            },
        },
    });
});

// Mount API routes
app.use('/api', routes);

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
    });
});

// ==========================================
// ERROR HANDLER
// ==========================================

interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}

app.use((err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
    console.error('❌ Error:', err.message);

    if (config.nodeEnv === 'development') {
        console.error(err.stack);
    }

    const statusCode = err.statusCode || 500;
    const message = config.nodeEnv === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message;

    res.status(statusCode).json({
        success: false,
        error: message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
});

export default app;
