import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../config/index.js';

// ==========================================
// Processing Lock Interface
// ==========================================

export interface IProcessingLockMetadata {
    videoId?: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    targetDuration?: number;
    estimatedCompletion?: Date;
}

export interface IProcessingLock extends Document {
    _id: mongoose.Types.ObjectId;
    key: string;
    isLocked: boolean;
    lockedBy: string;
    lockedAt?: Date;
    expiresAt?: Date;
    metadata: IProcessingLockMetadata;
    createdAt: Date;
    updatedAt: Date;
}

export interface IProcessingLockMethods {
    isExpired(): boolean;
    extend(minutes: number): Promise<IProcessingLock>;
    release(): Promise<IProcessingLock>;
}

export interface ProcessingLockModel extends Model<IProcessingLock, {}, IProcessingLockMethods> {
    acquireLock(
        key: string,
        lockedBy: string,
        metadata?: IProcessingLockMetadata,
        timeoutMs?: number
    ): Promise<IProcessingLock | null>;
    releaseLock(key: string): Promise<boolean>;
    getLock(key: string): Promise<IProcessingLock | null>;
    isLocked(key: string): Promise<boolean>;
    cleanupExpiredLocks(): Promise<number>;
}

// ==========================================
// Schema Definition
// ==========================================

const processingLockMetadataSchema = new Schema<IProcessingLockMetadata>(
    {
        videoId: {
            type: Schema.Types.ObjectId,
            ref: 'Video',
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        targetDuration: {
            type: Number,
            min: 60,
            max: 120,
        },
        estimatedCompletion: {
            type: Date,
        },
    },
    { _id: false }
);

const processingLockSchema = new Schema<
    IProcessingLock,
    ProcessingLockModel,
    IProcessingLockMethods
>(
    {
        key: {
            type: String,
            required: [true, 'Lock key is required'],
            unique: true,
            index: true,
        },
        isLocked: {
            type: Boolean,
            default: false,
        },
        lockedBy: {
            type: String,
            required: [true, 'Lock owner is required'],
        },
        lockedAt: {
            type: Date,
        },
        expiresAt: {
            type: Date,
            index: true,
        },
        metadata: {
            type: processingLockMetadataSchema,
            default: {},
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret) => {
                const { __v, ...rest } = ret;
                return rest;
            },
        },
    }
);

// ==========================================
// Indexes
// ==========================================

// Index for finding expired locks
processingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for lock queries
processingLockSchema.index({ key: 1, isLocked: 1 });

// ==========================================
// Instance Methods
// ==========================================

processingLockSchema.methods.isExpired = function (): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

processingLockSchema.methods.extend = async function (
    minutes: number
): Promise<IProcessingLock> {
    const newExpiry = new Date(Date.now() + minutes * 60 * 1000);
    this.expiresAt = newExpiry;
    return await this.save();
};

processingLockSchema.methods.release = async function (): Promise<IProcessingLock> {
    this.isLocked = false;
    this.expiresAt = undefined;
    this.metadata = {};
    return await this.save();
};

// ==========================================
// Static Methods
// ==========================================

/**
 * Attempt to acquire a lock
 * Returns the lock document if successful, null if lock is already held
 */
processingLockSchema.statics.acquireLock = async function (
    key: string,
    lockedBy: string,
    metadata: IProcessingLockMetadata = {},
    timeoutMs: number = config.processing.lockTimeoutMs
): Promise<IProcessingLock | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMs);

    // Use findOneAndUpdate with upsert for atomic lock acquisition
    try {
        const lock = await this.findOneAndUpdate(
            {
                key,
                $or: [
                    { isLocked: false },
                    { expiresAt: { $lt: now } }, // Lock has expired
                ],
            },
            {
                $set: {
                    isLocked: true,
                    lockedBy,
                    lockedAt: now,
                    expiresAt,
                    metadata,
                },
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        // Verify we actually got the lock
        if (lock && lock.lockedBy === lockedBy) {
            console.log(`✅ Lock acquired: ${key} by ${lockedBy}`);
            return lock;
        }

        return null;
    } catch (error: any) {
        // Duplicate key error means another process got the lock
        if (error.code === 11000) {
            console.log(`⚠️ Lock already held: ${key}`);
            return null;
        }
        throw error;
    }
};

/**
 * Release a lock by key
 */
processingLockSchema.statics.releaseLock = async function (
    key: string
): Promise<boolean> {
    const result = await this.findOneAndUpdate(
        { key },
        {
            $set: {
                isLocked: false,
                expiresAt: null,
                metadata: {},
            },
        }
    );

    if (result) {
        console.log(`✅ Lock released: ${key}`);
        return true;
    }
    return false;
};

/**
 * Get current lock status
 */
processingLockSchema.statics.getLock = async function (
    key: string
): Promise<IProcessingLock | null> {
    const lock = await this.findOne({ key });

    if (lock && lock.isLocked && lock.expiresAt && new Date() > lock.expiresAt) {
        // Lock has expired, clean it up
        lock.isLocked = false;
        lock.expiresAt = undefined;
        lock.metadata = {};
        await lock.save();
        return lock;
    }

    return lock;
};

/**
 * Check if a lock is currently held (and not expired)
 */
processingLockSchema.statics.isLocked = async function (
    key: string
): Promise<boolean> {
    const lock = await this.getLock(key);
    return lock?.isLocked === true;
};

/**
 * Clean up all expired locks
 */
processingLockSchema.statics.cleanupExpiredLocks = async function (): Promise<number> {
    const result = await this.updateMany(
        {
            isLocked: true,
            expiresAt: { $lt: new Date() },
        },
        {
            $set: {
                isLocked: false,
                expiresAt: null,
                metadata: {},
            },
        }
    );

    if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up ${result.modifiedCount} expired locks`);
    }

    return result.modifiedCount;
};

// ==========================================
// Constants
// ==========================================

export const LOCK_KEYS = {
    VIDEO_PROCESSING: 'video_processing_lock',
    SEGMENT_GENERATION: 'segment_generation_lock',
    AUDIO_GENERATION: 'audio_generation_lock',
} as const;

// ==========================================
// Export Model
// ==========================================

export const ProcessingLock = mongoose.model<IProcessingLock, ProcessingLockModel>(
    'ProcessingLock',
    processingLockSchema
);

export default ProcessingLock;
