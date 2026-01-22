import { Video } from '../models/index.js';
import { storageService } from '../services/index.js';

// ==========================================
// Recovery Service
// ==========================================

interface RecoveryResult {
    recovered: boolean;
    message: string;
    resumeFrom?: number;
}

export class RecoveryService {
    /**
     * Check for and recover interrupted video processing
     */
    async recoverInterruptedVideos(): Promise<number> {
        let recoveredCount = 0;

        // Find videos that were processing but never completed
        const interruptedVideos = await Video.find({
            status: { $in: ['generating', 'stitching', 'audio', 'merging', 'transcoding'] },
            updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }, // Not updated in 30 minutes
        });

        for (const video of interruptedVideos) {
            const result = await this.recoverVideo(video._id.toString());
            if (result.recovered) {
                recoveredCount++;
            }
        }

        if (recoveredCount > 0) {
            console.log(`🔧 Recovered ${recoveredCount} interrupted videos`);
        }

        return recoveredCount;
    }

    /**
     * Recover a specific video
     */
    async recoverVideo(videoId: string): Promise<RecoveryResult> {
        const video = await Video.findById(videoId);

        if (!video) {
            return { recovered: false, message: 'Video not found' };
        }

        // Determine recovery strategy based on status
        switch (video.status) {
            case 'generating':
                return this.recoverFromGeneration(video);
            case 'stitching':
                return this.recoverFromStitching(video);
            case 'audio':
            case 'merging':
            case 'transcoding':
                return this.recoverFromPostProcessing(video);
            default:
                return { recovered: false, message: 'Video not in recoverable state' };
        }
    }

    /**
     * Recover from segment generation phase
     * Find last completed segment and resume from there
     */
    private async recoverFromGeneration(video: any): Promise<RecoveryResult> {
        const segments = video.segments || [];

        // Find the first incomplete segment
        let resumeFrom = 1;
        for (let i = 0; i < segments.length; i++) {
            if (segments[i].status === 'completed') {
                resumeFrom = i + 2; // Next segment after completed
            } else {
                break;
            }
        }

        // Reset video to pending state at the resume point
        await Video.findByIdAndUpdate(video._id, {
            $set: {
                status: 'pending',
                currentSegment: resumeFrom,
                errorMessage: null,
            },
        });

        console.log(`📍 Video ${video._id}: Resuming from segment ${resumeFrom}`);

        return {
            recovered: true,
            message: `Marked for resume from segment ${resumeFrom}`,
            resumeFrom,
        };
    }

    /**
     * Recover from stitching phase
     * Check if segments exist and can be stitched
     */
    private async recoverFromStitching(video: any): Promise<RecoveryResult> {
        const segmentPaths = await storageService.getExistingSegmentPaths(
            video.userId,
            video._id.toString()
        );

        if (segmentPaths.length === video.segmentCount) {
            // All segments exist, can retry stitching
            await Video.findByIdAndUpdate(video._id, {
                $set: {
                    status: 'pending',
                    currentPhase: 'stitching',
                    errorMessage: null,
                },
            });

            return {
                recovered: true,
                message: 'Ready to retry stitching',
            };
        }

        // Missing segments, need to regenerate
        return this.recoverFromGeneration(video);
    }

    /**
     * Recover from post-processing phases
     */
    private async recoverFromPostProcessing(video: any): Promise<RecoveryResult> {
        // Check if stitched video exists
        const paths = storageService.getVideoPaths(video.userId, video._id.toString());
        const stitchedExists = await storageService.fileExists(paths.stitched720p);

        if (stitchedExists) {
            // Can resume from audio phase
            await Video.findByIdAndUpdate(video._id, {
                $set: {
                    status: 'pending',
                    currentPhase: 'audio',
                    errorMessage: null,
                },
            });

            return {
                recovered: true,
                message: 'Ready to retry audio generation',
            };
        }

        // Need to restart from stitching
        return this.recoverFromStitching(video);
    }

    /**
     * Get recovery status for a video
     */
    async getRecoveryInfo(videoId: string): Promise<{
        canRecover: boolean;
        lastCompletedSegment: number;
        totalSegments: number;
        phase: string;
    }> {
        const video = await Video.findById(videoId);

        if (!video) {
            return {
                canRecover: false,
                lastCompletedSegment: 0,
                totalSegments: 0,
                phase: 'unknown',
            };
        }

        const segments = video.segments || [];
        let lastCompleted = 0;

        for (let i = 0; i < segments.length; i++) {
            if (segments[i].status === 'completed') {
                lastCompleted = i + 1;
            } else {
                break;
            }
        }

        return {
            canRecover: ['generating', 'stitching', 'audio', 'merging', 'transcoding', 'failed'].includes(video.status),
            lastCompletedSegment: lastCompleted,
            totalSegments: video.segmentCount || 0,
            phase: video.currentPhase || video.status,
        };
    }
}

// Singleton
export const recoveryService = new RecoveryService();
export default recoveryService;
