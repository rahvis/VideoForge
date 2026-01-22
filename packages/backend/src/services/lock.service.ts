import { ProcessingLock, LOCK_KEYS, type IProcessingLock, type IProcessingLockMetadata } from '../models/index.js';
import { config } from '../config/index.js';

// ==========================================
// Processing Lock Service
// ==========================================

export class LockService {
    private readonly defaultTimeoutMs: number;

    constructor() {
        this.defaultTimeoutMs = config.processing.lockTimeoutMs; // 30 minutes
    }

    /**
     * Attempt to acquire the video processing lock
     */
    async acquireVideoProcessingLock(
        lockedBy: string,
        metadata?: IProcessingLockMetadata
    ): Promise<IProcessingLock | null> {
        return await ProcessingLock.acquireLock(
            LOCK_KEYS.VIDEO_PROCESSING,
            lockedBy,
            metadata,
            this.defaultTimeoutMs
        );
    }

    /**
     * Release the video processing lock
     */
    async releaseVideoProcessingLock(): Promise<boolean> {
        return await ProcessingLock.releaseLock(LOCK_KEYS.VIDEO_PROCESSING);
    }

    /**
     * Check if video processing is currently locked
     */
    async isVideoProcessingLocked(): Promise<boolean> {
        return await ProcessingLock.isLocked(LOCK_KEYS.VIDEO_PROCESSING);
    }

    /**
     * Get current lock status with metadata
     */
    async getVideoProcessingLockStatus(): Promise<{
        isLocked: boolean;
        lockedBy?: string;
        lockedAt?: Date;
        expiresAt?: Date;
        metadata?: IProcessingLockMetadata;
    }> {
        const lock = await ProcessingLock.getLock(LOCK_KEYS.VIDEO_PROCESSING);

        if (!lock || !lock.isLocked) {
            return { isLocked: false };
        }

        return {
            isLocked: true,
            lockedBy: lock.lockedBy,
            lockedAt: lock.lockedAt,
            expiresAt: lock.expiresAt,
            metadata: lock.metadata,
        };
    }

    /**
     * Extend the current lock timeout
     */
    async extendLock(additionalMinutes: number = 15): Promise<boolean> {
        const lock = await ProcessingLock.getLock(LOCK_KEYS.VIDEO_PROCESSING);

        if (!lock || !lock.isLocked) {
            return false;
        }

        const newExpiry = new Date(Date.now() + additionalMinutes * 60 * 1000);
        lock.expiresAt = newExpiry;
        await lock.save();
        console.log(`✅ Lock extended by ${additionalMinutes} minutes`);
        return true;
    }

    /**
     * Force release a lock (admin use only)
     */
    async forceReleaseLock(): Promise<boolean> {
        console.warn('⚠️ Force releasing video processing lock');
        return await ProcessingLock.releaseLock(LOCK_KEYS.VIDEO_PROCESSING);
    }

    /**
     * Cleanup all expired locks
     */
    async cleanupExpiredLocks(): Promise<number> {
        return await ProcessingLock.cleanupExpiredLocks();
    }

    /**
     * Get estimated time until lock expires
     */
    async getTimeUntilExpiry(): Promise<number | null> {
        const lock = await ProcessingLock.getLock(LOCK_KEYS.VIDEO_PROCESSING);

        if (!lock || !lock.isLocked || !lock.expiresAt) {
            return null;
        }

        return Math.max(0, lock.expiresAt.getTime() - Date.now());
    }
}

// Singleton instance
export const lockService = new LockService();

export default lockService;
