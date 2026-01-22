import { Router, type IRouter } from 'express';
import { asyncHandler } from '../middleware/index.js';
import {
    lockService,
    storageService,
    segmentCacheService,
} from '../services/index.js';
import mongoose from 'mongoose';

// ==========================================
// System Routes
// ==========================================

const router: IRouter = Router();

/**
 * GET /api/system/status
 * Get overall system status
 */
router.get(
    '/status',
    asyncHandler(async (_req, res) => {
        const dbState = mongoose.connection.readyState;
        const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

        const lockStatus = await lockService.getVideoProcessingLockStatus();
        const storageStats = await storageService.getStorageStats();
        const cacheStats = await segmentCacheService.getStats();

        res.json({
            success: true,
            data: {
                status: 'operational',
                timestamp: new Date().toISOString(),
                database: {
                    status: dbStatus,
                },
                processing: {
                    isLocked: lockStatus.isLocked,
                    lockedBy: lockStatus.lockedBy,
                    lockedAt: lockStatus.lockedAt,
                    expiresAt: lockStatus.expiresAt,
                    metadata: lockStatus.metadata,
                },
                storage: {
                    totalVideos: storageStats.totalVideos,
                    totalSizeBytes: storageStats.totalSize,
                    tempSizeBytes: storageStats.tempSize,
                },
                cache: {
                    totalEntries: cacheStats.totalEntries,
                    totalSizeBytes: cacheStats.totalSizeBytes,
                },
            },
        });
    })
);

/**
 * GET /api/system/lock
 * Get current processing lock status
 */
router.get(
    '/lock',
    asyncHandler(async (_req, res) => {
        const lockStatus = await lockService.getVideoProcessingLockStatus();

        res.json({
            success: true,
            data: {
                isLocked: lockStatus.isLocked,
                lockedBy: lockStatus.lockedBy,
                lockedAt: lockStatus.lockedAt,
                expiresAt: lockStatus.expiresAt,
                metadata: lockStatus.metadata,
                timeUntilExpiry: lockStatus.expiresAt
                    ? Math.max(0, new Date(lockStatus.expiresAt).getTime() - Date.now())
                    : null,
            },
        });
    })
);

/**
 * GET /api/system/health
 * Simple health check
 */
router.get('/health', (_req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

export default router;
