import { Video, type IVideo, type IVideoSegment } from '../models/index.js';
import { lockService } from './lock.service.js';
import { sceneDecompositionService } from './scene-decomposition.service.js';
import { promptService } from './prompt.service.js';
import { segmentGenerationService } from './segment-generation.service.js';
import { frameExtractionService } from './frame-extraction.service.js';
import { videoStitchingService } from './video-stitching.service.js';
import { audioService } from './audio.service.js';
import { storageService } from './storage.service.js';
import { config } from '../config/index.js';

// ==========================================
// Processing Service (Main Orchestrator)
// ==========================================

type ProcessingPhase =
    | 'decomposing'
    | 'generating'
    | 'stitching'
    | 'audio'
    | 'merging'
    | 'transcoding'
    | 'completed'
    | 'failed';

interface ProcessingProgress {
    phase: ProcessingPhase;
    progress: number;
    currentSegment?: number;
    message?: string;
}

export class ProcessingService {
    private readonly maxRetries: number;

    constructor() {
        this.maxRetries = config.duration.maxRetries;
    }

    /**
     * Process a video end-to-end
     */
    async processVideo(videoId: string): Promise<void> {
        const video = await Video.findById(videoId);

        if (!video) {
            throw new Error(`Video not found: ${videoId}`);
        }

        const userId = video.userId.toString();
        const lockOwner = `processing-${videoId}`;

        console.log(`\n🎬 Starting video processing: ${videoId}`);
        console.log(`📊 Target duration: ${video.targetDuration}s (${video.segmentCount} segments)`);

        // Acquire processing lock
        const lock = await lockService.acquireVideoProcessingLock(lockOwner, {
            videoId: video._id,
            userId: video.userId,
            targetDuration: video.targetDuration,
            estimatedCompletion: new Date(Date.now() + video.targetDuration * 60 * 1000),
        });

        if (!lock) {
            throw new Error('System is busy processing another video');
        }

        try {
            // Create storage directories
            const paths = await storageService.createVideoDirectories(userId, videoId);

            // Phase 1: Scene Decomposition (0-5%)
            // Skip if scenes were already provided (user edited them in the UI)
            let scenes = video.scenes || [];
            if (scenes.length === 0) {
                await this.updateProgress(videoId, 'decomposing', 0, 'Decomposing prompt into scenes');
                scenes = await this.decomposeScenes(video);
                await this.updateProgress(videoId, 'decomposing', 5, 'Scenes decomposed');
            } else {
                console.log(`📋 Using ${scenes.length} user-provided scenes`);
                await this.updateProgress(videoId, 'decomposing', 5, 'Using custom scenes');
            }

            // Phase 2: Sequential Segment Generation (5-70%)
            await this.updateProgress(videoId, 'generating', 5, 'Starting segment generation');
            await this.generateAllSegments(video, scenes, paths, userId, videoId);
            await this.updateProgress(videoId, 'generating', 70, 'All segments generated');

            // Phase 3: Video Stitching (70-80%)
            await this.updateProgress(videoId, 'stitching', 70, 'Stitching video segments');
            await this.stitchSegments(video, paths, userId, videoId);
            await this.updateProgress(videoId, 'stitching', 80, 'Video stitched');

            // Phase 4: Audio Generation (80-90%)
            await this.updateProgress(videoId, 'audio', 80, 'Generating narration');
            await this.generateAudio(video, scenes, paths);
            await this.updateProgress(videoId, 'audio', 90, 'Audio generated');

            // Phase 5: Audio-Video Merge (90-95%)
            await this.updateProgress(videoId, 'merging', 90, 'Merging audio and video');
            await this.mergeAudioVideo(video, paths);
            await this.updateProgress(videoId, 'merging', 95, 'Audio merged');

            // Phase 6: Transcoding (95-100%)
            await this.updateProgress(videoId, 'transcoding', 95, 'Creating additional resolutions');
            await this.transcodeResolutions(video, paths, userId, videoId);

            // Complete
            await this.updateProgress(videoId, 'completed', 100, 'Video processing complete');

            console.log(`\n✅ Video processing completed: ${videoId}`);

        } catch (error: any) {
            console.error(`\n❌ Video processing failed: ${error.message}`);
            await this.handleProcessingError(videoId, error);
            throw error;
        } finally {
            // Always release the lock
            await lockService.releaseVideoProcessingLock();
        }
    }

    /**
     * Phase 1: Decompose prompt into scenes
     */
    private async decomposeScenes(video: IVideo) {
        console.log('\n📋 Phase 1: Scene Decomposition');

        try {
            const result = await sceneDecompositionService.decomposePrompt(
                video.enhancedPrompt || video.originalPrompt,
                video.targetDuration
            );

            // Update video with scenes
            await Video.findByIdAndUpdate(video._id, {
                scenes: result.scenes,
                segmentCount: result.segmentCount,
            });

            return result.scenes;
        } catch (error: any) {
            // Use fallback if decomposition fails
            console.warn('⚠️ Using fallback scene decomposition');
            const result = sceneDecompositionService.generateFallbackScenes(
                video.enhancedPrompt || video.originalPrompt,
                video.targetDuration
            );

            await Video.findByIdAndUpdate(video._id, {
                scenes: result.scenes,
                segmentCount: result.segmentCount,
            });

            return result.scenes;
        }
    }

    /**
     * Phase 2: Generate all video segments sequentially
     */
    private async generateAllSegments(
        _video: IVideo,
        scenes: any[],
        _paths: any,
        userId: string,
        videoId: string
    ): Promise<void> {
        console.log('\n🎥 Phase 2: Segment Generation');

        let previousFramePath: string | null = null;

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const segmentNumber = i + 1;

            // Calculate progress (5-70% range, distributed across segments)
            const segmentProgress = 5 + (65 * ((i + 0.5) / scenes.length));
            await this.updateProgress(
                videoId,
                'generating',
                Math.round(segmentProgress),
                `Generating segment ${segmentNumber} of ${scenes.length}`,
                segmentNumber
            );

            // Generate segment with retry
            const segmentPath = storageService.getSegmentPath(userId, videoId, segmentNumber);
            const duration = scene.endTime - scene.startTime;
            const result = await this.generateSegmentWithRetry(
                scene.scenePrompt,
                segmentNumber,
                segmentPath,
                previousFramePath,
                videoId,
                duration
            );

            if (result.status === 'failed') {
                throw new Error(`Segment ${segmentNumber} failed after ${this.maxRetries} retries`);
            }

            // Extract last frame for next segment's continuity
            if (i < scenes.length - 1) {
                const framePath = storageService.getFramePath(userId, videoId, segmentNumber);
                previousFramePath = await frameExtractionService.extractLastFrame(segmentPath, framePath);

                // Update segment with frame path
                await this.updateSegmentStatus(videoId, segmentNumber, {
                    lastFramePath: framePath,
                });
            }
        }
    }

    /**
     * Generate a single segment with retry logic
     */
    private async generateSegmentWithRetry(
        scenePrompt: string,
        segmentNumber: number,
        outputPath: string,
        previousFramePath: string | null,
        videoId: string,
        duration?: number
    ): Promise<{ status: 'completed' | 'failed'; error?: string }> {

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            console.log(`🎬 Segment ${segmentNumber}, attempt ${attempt}/${this.maxRetries}`);

            try {
                // Update segment status
                await this.updateSegmentStatus(videoId, segmentNumber, {
                    status: 'generating',
                    retryCount: attempt - 1,
                    startedAt: new Date(),
                });

                // Generate segment with callback to save jobId immediately
                const result = await segmentGenerationService.generateAndSaveSegment(
                    scenePrompt,
                    segmentNumber,
                    outputPath,
                    previousFramePath || undefined,
                    duration,
                    // Save the jobId immediately when the job starts
                    async (jobId: string) => {
                        await this.updateSegmentStatus(videoId, segmentNumber, {
                            soraJobId: jobId,
                        });
                    }
                );

                if (result.status === 'completed') {
                    await this.updateSegmentStatus(videoId, segmentNumber, {
                        status: 'completed',
                        filePath: outputPath,
                        soraJobId: result.jobId,
                        completedAt: new Date(),
                    });

                    return { status: 'completed' };
                }

                // Generation failed
                console.warn(`⚠️ Segment ${segmentNumber} attempt ${attempt} failed: ${result.error}`);

                if (attempt < this.maxRetries) {
                    // Wait before retry (exponential backoff)
                    await this.sleep(5000 * attempt);
                }

            } catch (error: any) {
                console.error(`❌ Segment ${segmentNumber} error:`, error.message);

                if (attempt === this.maxRetries) {
                    await this.updateSegmentStatus(videoId, segmentNumber, {
                        status: 'failed',
                        error: error.message,
                    });

                    return { status: 'failed', error: error.message };
                }

                await this.sleep(5000 * attempt);
            }
        }

        return { status: 'failed', error: 'Max retries exceeded' };
    }

    /**
     * Phase 3: Stitch video segments together
     */
    private async stitchSegments(
        video: IVideo,
        paths: any,
        userId: string,
        videoId: string
    ): Promise<void> {
        console.log('\n🔗 Phase 3: Video Stitching');

        const segmentPaths = await storageService.getExistingSegmentPaths(userId, videoId);

        if (segmentPaths.length === 0) {
            throw new Error('No segments found to stitch');
        }

        await videoStitchingService.stitchWithCrossfade(segmentPaths, paths.stitched720p);

        // Update video with stitched file info
        const fileSize = await storageService.getFileSize(paths.stitched720p);
        await Video.findByIdAndUpdate(video._id, {
            'files.stitched_720p': {
                path: paths.stitched720p,
                url: storageService.getPublicUrl(paths.stitched720p),
                size: fileSize,
                format: 'mp4',
            },
        });
    }

    /**
 * Phase 4: Generate audio narration
 */
    private async generateAudio(
        video: IVideo,
        scenes: any[],
        paths: any
    ): Promise<void> {
        console.log('\n🎙️ Phase 4: Audio Generation');

        // Check if scenes have user-provided narration text
        const hasUserNarration = scenes.some(s => s.narrationText && s.narrationText.trim());

        let script: string;
        if (hasUserNarration) {
            // Use user-provided narration text from each scene
            console.log('📝 Using user-provided narration text');
            script = scenes
                .map(s => s.narrationText?.trim() || '')
                .filter(text => text.length > 0)
                .join(' ');
        } else {
            // Generate narration script via GPT-4o
            script = await promptService.generateNarrationScript(
                video.enhancedPrompt || video.originalPrompt,
                scenes,
                video.targetDuration
            );
        }

        // Generate audio
        await audioService.generateNarration(script, paths.audio);

        // Update video with audio info
        const fileSize = await storageService.getFileSize(paths.audio);
        await Video.findByIdAndUpdate(video._id, {
            'files.audio': {
                path: paths.audio,
                url: storageService.getPublicUrl(paths.audio),
                size: fileSize,
                format: 'mp3',
            },
        });
    }
    /**
     * Phase 5: Merge audio with video
     */
    private async mergeAudioVideo(video: IVideo, paths: any): Promise<void> {
        console.log('\n🎵 Phase 5: Audio-Video Merge');

        await videoStitchingService.mergeAudioVideo(
            paths.stitched720p,
            paths.audio,
            paths.final720p
        );

        // Generate thumbnail
        await frameExtractionService.generateThumbnail(paths.final720p, paths.thumbnail);

        // Update video with final file info
        const [videoSize, thumbSize, metadata] = await Promise.all([
            storageService.getFileSize(paths.final720p),
            storageService.getFileSize(paths.thumbnail),
            frameExtractionService.getVideoMetadata(paths.final720p),
        ]);

        await Video.findByIdAndUpdate(video._id, {
            'files.final_720p': {
                path: paths.final720p,
                url: storageService.getPublicUrl(paths.final720p),
                size: videoSize,
                format: 'mp4',
                duration: metadata.duration,
            },
            'files.thumbnail': {
                path: paths.thumbnail,
                url: storageService.getPublicUrl(paths.thumbnail),
                size: thumbSize,
                format: 'jpg',
            },
            actualDuration: metadata.duration,
            'metadata.resolution': `${metadata.width}x${metadata.height}`,
            'metadata.fps': metadata.fps,
            'metadata.codec': metadata.codec,
        });
    }

    /**
     * Phase 6: Transcode to additional resolutions
     */
    private async transcodeResolutions(
        video: IVideo,
        paths: any,
        _userId: string,
        _videoId: string
    ): Promise<void> {
        console.log('\n📐 Phase 6: Transcoding');

        // Create 480p version
        await videoStitchingService.transcodeResolution(
            paths.final720p,
            paths.final480p,
            854,
            480
        );

        const fileSize = await storageService.getFileSize(paths.final480p);

        await Video.findByIdAndUpdate(video._id, {
            'files.final_480p': {
                path: paths.final480p,
                url: storageService.getPublicUrl(paths.final480p),
                size: fileSize,
                format: 'mp4',
            },
        });
    }

    /**
     * Update video progress
     */
    private async updateProgress(
        videoId: string,
        phase: ProcessingPhase,
        progress: number,
        message?: string,
        currentSegment?: number
    ): Promise<void> {
        const updateData: any = {
            status: phase,
            progress,
            currentPhase: message || phase,
        };

        if (currentSegment !== undefined) {
            updateData.currentSegment = currentSegment;
        }

        if (phase === 'completed') {
            updateData.completedAt = new Date();
        }

        await Video.findByIdAndUpdate(videoId, updateData);

        console.log(`📊 [${phase}] ${progress}% - ${message || ''}`);
    }

    /**
     * Update segment status
     */
    private async updateSegmentStatus(
        videoId: string,
        segmentNumber: number,
        updates: Partial<IVideoSegment>
    ): Promise<void> {
        await Video.findOneAndUpdate(
            { _id: videoId, 'segments.segmentNumber': segmentNumber },
            {
                $set: Object.fromEntries(
                    Object.entries(updates).map(([k, v]) => [`segments.$.${k}`, v])
                )
            }
        );
    }

    /**
     * Handle processing error
     */
    private async handleProcessingError(videoId: string, error: Error): Promise<void> {
        await Video.findByIdAndUpdate(videoId, {
            status: 'failed',
            errorMessage: error.message,
        });
    }

    /**
     * Get processing status
     */
    async getProcessingStatus(videoId: string): Promise<ProcessingProgress | null> {
        const video = await Video.findById(videoId);

        if (!video) {
            return null;
        }

        return {
            phase: video.status as ProcessingPhase,
            progress: video.progress,
            currentSegment: video.currentSegment,
            message: video.currentPhase,
        };
    }

    /**
     * Cancel video processing
     */
    async cancelProcessing(videoId: string): Promise<boolean> {
        const video = await Video.findById(videoId);

        if (!video || ['completed', 'failed', 'pending'].includes(video.status)) {
            return false;
        }

        await Video.findByIdAndUpdate(videoId, {
            status: 'failed',
            errorMessage: 'Processing cancelled by user',
        });

        await lockService.releaseVideoProcessingLock();

        console.log(`⚠️ Processing cancelled: ${videoId}`);
        return true;
    }

    /**
     * Resume incomplete video processing
     */
    async resumeIncompleteVideos(): Promise<void> {
        const { Video: VideoModel } = await import('../models/index.js');

        const incompleteVideos = await VideoModel.find({
            status: { $nin: ['completed', 'failed', 'pending'] },
        }).sort({ updatedAt: 1 });

        if (incompleteVideos.length > 0) {
            console.log(`📋 Found ${incompleteVideos.length} incomplete videos`);

            // Mark them as failed for now (can implement resume logic later)
            for (const video of incompleteVideos) {
                await VideoModel.findByIdAndUpdate(video._id, {
                    status: 'failed',
                    errorMessage: 'Processing interrupted - server restart',
                });
            }
        }
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const processingService = new ProcessingService();

export default processingService;
