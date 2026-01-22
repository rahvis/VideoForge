import { Router, type IRouter, Request, Response } from 'express';
import { validate, authenticate, asyncHandler } from '../middleware/index.js';
import {
    createVideoSchema,
    updateVideoSchema,
    paginationSchema,
    idParamSchema,
} from '../validators/index.js';
import {
    processingService,
    promptService,
    lockService,
    storageService,
} from '../services/index.js';
import { Video } from '../models/index.js';

// ==========================================
// Video Routes
// ==========================================

const router: IRouter = Router();

/**
 * POST /api/videos/create
 * Create a new video (60-120 seconds)
 */
router.post(
    '/create',
    authenticate,
    validate(createVideoSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { prompt, originalPrompt, duration, voiceId, scenes } = req.body;
        const userId = req.userId!;

        // Check if processing is available
        const isLocked = await lockService.isVideoProcessingLocked();
        if (isLocked) {
            res.status(503).json({
                success: false,
                error: 'System is busy processing another video. Please try again later.',
            });
            return;
        }

        // Enhance the prompt
        const enhanced = await promptService.enhancePrompt(prompt, duration);

        // Calculate segments
        const segmentDuration = 12;
        const segmentCount = scenes?.length || Math.ceil(duration / segmentDuration);

        // Create video document
        const video = new Video({
            userId,
            title: enhanced.title,
            originalPrompt: originalPrompt || prompt,
            enhancedPrompt: enhanced.enhancedPrompt,
            targetDuration: duration,
            segmentDuration,
            segmentCount,
            status: 'pending',
            progress: 0,
            // Use custom scenes if provided (user edited them)
            scenes: scenes || [],
            metadata: {
                voiceId: voiceId || undefined,
            },
        });

        await video.save();

        // Start processing in background
        setImmediate(() => {
            processingService.processVideo(video._id.toString()).catch((error) => {
                console.error(`Background processing failed: ${error.message}`);
            });
        });

        res.status(201).json({
            success: true,
            message: 'Video creation started',
            data: {
                id: video._id,
                title: video.title,
                originalPrompt: video.originalPrompt,
                enhancedPrompt: video.enhancedPrompt,
                targetDuration: video.targetDuration,
                segmentCount: video.segmentCount,
                status: video.status,
            },
        });
    })
);

/**
 * GET /api/videos
 * List user's videos
 */
router.get(
    '/',
    authenticate,
    validate(paginationSchema, 'query'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { page, limit } = req.query as unknown as { page: number; limit: number };

        const skip = (page - 1) * limit;

        const [videos, total] = await Promise.all([
            Video.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-segments -scenes'),
            Video.countDocuments({ userId }),
        ]);

        res.json({
            success: true,
            data: {
                videos: videos.map((v) => ({
                    id: v._id,
                    title: v.title,
                    status: v.status,
                    progress: v.progress,
                    targetDuration: v.targetDuration,
                    actualDuration: v.actualDuration,
                    segmentCount: v.segmentCount,
                    thumbnail: v.files?.thumbnail?.url,
                    createdAt: v.createdAt,
                    updatedAt: v.updatedAt,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    })
);

/**
 * GET /api/videos/:id
 * Get video details
 */
router.get(
    '/:id',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;

        const video = await Video.findOne({ _id: id, userId });

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        res.json({
            success: true,
            data: {
                id: video._id,
                title: video.title,
                originalPrompt: video.originalPrompt,
                enhancedPrompt: video.enhancedPrompt,
                targetDuration: video.targetDuration,
                actualDuration: video.actualDuration,
                segmentDuration: video.segmentDuration,
                segmentCount: video.segmentCount,
                status: video.status,
                progress: video.progress,
                currentPhase: video.currentPhase,
                currentSegment: video.currentSegment,
                errorMessage: video.errorMessage,
                scenes: video.scenes,
                files: video.files,
                metadata: video.metadata,
                createdAt: video.createdAt,
                updatedAt: video.updatedAt,
            },
        });
    })
);

/**
 * GET /api/videos/:id/status
 * Get video status with segment progress
 */
router.get(
    '/:id/status',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;

        const video = await Video.findOne({ _id: id, userId }).select(
            'status progress currentPhase currentSegment segmentCount segments errorMessage'
        );

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        const completedSegments = video.segments?.filter((s) => s.status === 'completed').length || 0;
        const failedSegments = video.segments?.filter((s) => s.status === 'failed').length || 0;

        res.json({
            success: true,
            data: {
                id: video._id,
                status: video.status,
                progress: video.progress,
                currentPhase: video.currentPhase,
                currentSegment: video.currentSegment,
                segmentCount: video.segmentCount,
                completedSegments,
                failedSegments,
                errorMessage: video.errorMessage,
                isProcessing: !['completed', 'failed', 'pending'].includes(video.status),
            },
        });
    })
);

/**
 * GET /api/videos/:id/segments
 * Get individual segment statuses
 */
router.get(
    '/:id/segments',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;

        const video = await Video.findOne({ _id: id, userId }).select('segments scenes');

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        const segments = (video.segments || []).map((seg, index) => ({
            segmentNumber: seg.segmentNumber,
            status: seg.status,
            progress: seg.status === 'completed' ? 100 : seg.status === 'generating' ? 50 : 0,
            retryCount: seg.retryCount,
            error: seg.error,
            scene: video.scenes?.[index]
                ? {
                    scenePrompt: video.scenes[index].scenePrompt?.substring(0, 100),
                    transitionType: video.scenes[index].transitionType,
                }
                : null,
        }));

        res.json({
            success: true,
            data: {
                segments,
            },
        });
    })
);

/**
 * PATCH /api/videos/:id
 * Update video (title only for now)
 */
router.patch(
    '/:id',
    authenticate,
    validate(idParamSchema, 'params'),
    validate(updateVideoSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;
        const { title } = req.body;

        const video = await Video.findOneAndUpdate(
            { _id: id, userId },
            { $set: { title } },
            { new: true }
        );

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        res.json({
            success: true,
            data: {
                id: video._id,
                title: video.title,
            },
        });
    })
);

/**
 * POST /api/videos/:id/cancel
 * Cancel video processing
 */
router.post(
    '/:id/cancel',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;

        const video = await Video.findOne({ _id: id, userId });

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        const cancelled = await processingService.cancelProcessing(id);

        if (!cancelled) {
            res.status(400).json({
                success: false,
                error: 'Cannot cancel - video is not currently processing',
            });
            return;
        }

        res.json({
            success: true,
            message: 'Video processing cancelled',
        });
    })
);

/**
 * DELETE /api/videos/:id
 * Delete video and all associated files
 */
router.delete(
    '/:id',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;

        const video = await Video.findOne({ _id: id, userId });

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        // Don't allow deleting while processing
        if (!['completed', 'failed', 'pending'].includes(video.status)) {
            res.status(400).json({
                success: false,
                error: 'Cannot delete - video is still processing',
            });
            return;
        }

        // Delete files
        await storageService.deleteVideoFiles(userId, id);

        // Delete from database
        await Video.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Video deleted',
        });
    })
);

export default router;
