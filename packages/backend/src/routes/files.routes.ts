import { Router, type IRouter, Request, Response } from 'express';
import fs from 'fs/promises';
import { authenticate, asyncHandler } from '../middleware/index.js';
import { validate } from '../middleware/index.js';
import { idParamSchema } from '../validators/index.js';
import { Video } from '../models/index.js';

// ==========================================
// Files Routes
// ==========================================

const router: IRouter = Router();

/**
 * GET /api/files/:id/video
 * Download final video file
 */
router.get(
    '/:id/video',
    authenticate,
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!;
        const { id } = req.params;
        const quality = req.query.quality as string || '720p';

        const video = await Video.findOne({ _id: id, userId });

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        if (video.status !== 'completed') {
            res.status(400).json({
                success: false,
                error: 'Video processing not complete',
            });
            return;
        }

        const fileInfo = quality === '480p' ? video.files?.final_480p : video.files?.final_720p;

        if (!fileInfo?.path) {
            res.status(404).json({
                success: false,
                error: 'Video file not found',
            });
            return;
        }

        try {
            await fs.access(fileInfo.path);
        } catch {
            res.status(404).json({
                success: false,
                error: 'Video file not accessible',
            });
            return;
        }

        // Set headers for video streaming
        const stat = await fs.stat(fileInfo.path);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // Range request for video seeking
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            });

            const { createReadStream } = await import('fs');
            const stream = createReadStream(fileInfo.path, { start, end });
            stream.pipe(res);
        } else {
            // Full file download
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${video.title || 'video'}.mp4"`,
            });

            const { createReadStream } = await import('fs');
            const stream = createReadStream(fileInfo.path);
            stream.pipe(res);
        }
    })
);

/**
 * GET /api/files/:id/audio
 * Download audio file
 */
router.get(
    '/:id/audio',
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

        const fileInfo = video.files?.audio;

        if (!fileInfo?.path) {
            res.status(404).json({
                success: false,
                error: 'Audio file not found',
            });
            return;
        }

        try {
            await fs.access(fileInfo.path);
        } catch {
            res.status(404).json({
                success: false,
                error: 'Audio file not accessible',
            });
            return;
        }

        res.download(fileInfo.path, `${video.title || 'audio'}.mp3`);
    })
);

/**
 * GET /api/files/:id/thumbnail
 * Get video thumbnail
 */
router.get(
    '/:id/thumbnail',
    validate(idParamSchema, 'params'),
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;

        const video = await Video.findById(id);

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        const fileInfo = video.files?.thumbnail;

        if (!fileInfo?.path) {
            // Return a placeholder or 404
            res.status(404).json({
                success: false,
                error: 'Thumbnail not found',
            });
            return;
        }

        try {
            await fs.access(fileInfo.path);
            res.type('image/jpeg').sendFile(fileInfo.path);
        } catch {
            res.status(404).json({
                success: false,
                error: 'Thumbnail file not accessible',
            });
        }
    })
);

export default router;
