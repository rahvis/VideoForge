import fs from 'fs/promises';
import path from 'path';
import { Video } from '../models/index.js';
import { storageService } from './storage.service.js';

// ==========================================
// Rollback Service
// ==========================================

interface RollbackState {
    videoId: string;
    userId: string;
    phase: string;
    segmentsCompleted: number[];
    filesCreated: string[];
    timestamp: Date;
}

export class RollbackService {
    private readonly rollbackDir: string;

    constructor() {
        this.rollbackDir = path.join(process.cwd(), 'uploads', 'temp', 'rollback');
    }

    /**
     * Initialize rollback directory
     */
    async initialize(): Promise<void> {
        await fs.mkdir(this.rollbackDir, { recursive: true });
    }

    /**
     * Create a rollback checkpoint
     */
    async createCheckpoint(
        videoId: string,
        userId: string,
        phase: string,
        segmentsCompleted: number[],
        filesCreated: string[]
    ): Promise<string> {
        const checkpointId = `${videoId}_${Date.now()}`;
        const checkpointPath = path.join(this.rollbackDir, `${checkpointId}.json`);

        const state: RollbackState = {
            videoId,
            userId,
            phase,
            segmentsCompleted,
            filesCreated,
            timestamp: new Date(),
        };

        await fs.writeFile(checkpointPath, JSON.stringify(state, null, 2));
        console.log(`📍 Checkpoint created: ${phase} (${segmentsCompleted.length} segments)`);

        return checkpointId;
    }

    /**
     * Rollback a video to a specific checkpoint or clean state
     */
    async rollback(videoId: string, checkpoint?: string): Promise<void> {
        console.log(`⏪ Rolling back video: ${videoId}`);

        const video = await Video.findById(videoId);
        if (!video) {
            throw new Error(`Video not found: ${videoId}`);
        }

        const userId = video.userId.toString();

        if (checkpoint) {
            // Rollback to specific checkpoint
            await this.rollbackToCheckpoint(checkpoint);
        } else {
            // Full rollback - delete all files and reset video
            await this.fullRollback(videoId, userId);
        }
    }

    /**
     * Rollback to a specific checkpoint
     */
    private async rollbackToCheckpoint(checkpointId: string): Promise<void> {
        const checkpointPath = path.join(this.rollbackDir, `${checkpointId}.json`);

        try {
            const content = await fs.readFile(checkpointPath, 'utf-8');
            const state: RollbackState = JSON.parse(content);

            console.log(`⏪ Rolling back to checkpoint: ${state.phase}`);

            // Delete files created after this checkpoint
            // This would require tracking which files were created after this point
            // For simplicity, we just update the video status

            await Video.findByIdAndUpdate(state.videoId, {
                status: state.phase === 'generating' ? 'generating' : 'pending',
                currentSegment: state.segmentsCompleted.length,
                progress: Math.round((state.segmentsCompleted.length / 10) * 70), // Estimate
            });

            console.log(`✅ Rolled back to ${state.phase}`);
        } catch (error: any) {
            console.error(`❌ Checkpoint rollback failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Full rollback - delete all files and reset video
     */
    private async fullRollback(videoId: string, userId: string): Promise<void> {
        console.log('⏪ Performing full rollback...');

        // Delete video files
        await storageService.deleteVideoFiles(userId, videoId);

        // Reset video to pending status
        await Video.findByIdAndUpdate(videoId, {
            status: 'pending',
            progress: 0,
            currentPhase: '',
            currentSegment: 0,
            errorMessage: '',
            scenes: [],
            segments: [],
            files: {
                stitched_720p: null,
                final_720p: null,
                final_480p: null,
                audio: null,
                thumbnail: null,
            },
            actualDuration: undefined,
        });

        console.log('✅ Full rollback completed');
    }

    /**
     * Cleanup old checkpoints
     */
    async cleanupCheckpoints(videoId?: string, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
        let removed = 0;
        const cutoffTime = Date.now() - maxAgeMs;

        try {
            const files = await fs.readdir(this.rollbackDir);

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                const filePath = path.join(this.rollbackDir, file);
                const stats = await fs.stat(filePath);

                // Remove if too old
                if (stats.mtimeMs < cutoffTime) {
                    await fs.unlink(filePath);
                    removed++;
                    continue;
                }

                // Remove if for specific video
                if (videoId && file.startsWith(videoId)) {
                    await fs.unlink(filePath);
                    removed++;
                }
            }

            if (removed > 0) {
                console.log(`🧹 Removed ${removed} old checkpoints`);
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Checkpoint cleanup error:', error.message);
            }
        }

        return removed;
    }

    /**
     * Get latest checkpoint for a video
     */
    async getLatestCheckpoint(videoId: string): Promise<RollbackState | null> {
        try {
            const files = await fs.readdir(this.rollbackDir);
            const videoCheckpoints = files
                .filter((f) => f.startsWith(videoId) && f.endsWith('.json'))
                .sort()
                .reverse();

            if (videoCheckpoints.length === 0) return null;

            const latestPath = path.join(this.rollbackDir, videoCheckpoints[0]);
            const content = await fs.readFile(latestPath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Recover a failed video if possible
     */
    async attemptRecovery(videoId: string): Promise<boolean> {
        const checkpoint = await this.getLatestCheckpoint(videoId);

        if (!checkpoint) {
            console.log('❌ No checkpoint available for recovery');
            return false;
        }

        console.log(`🔄 Attempting recovery from checkpoint: ${checkpoint.phase}`);

        // For now, we just reset to the checkpoint state
        // A more sophisticated implementation could resume from here
        await this.rollbackToCheckpoint(`${videoId}_${checkpoint.timestamp.getTime()}`);

        return true;
    }
}

// Singleton instance
export const rollbackService = new RollbackService();

export default rollbackService;
