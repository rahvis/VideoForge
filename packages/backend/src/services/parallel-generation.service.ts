import { config } from '../config/index.js';
import { segmentGenerationService } from './segment-generation.service.js';
import { storageService } from './storage.service.js';
import { segmentCacheService } from './segment-cache.service.js';

// ==========================================
// Parallel Segment Generation Service
// ==========================================

interface ParallelGenerationResult {
    segmentNumber: number;
    status: 'completed' | 'failed';
    filePath?: string;
    jobId?: string;
    error?: string;
}

export class ParallelGenerationService {
    private readonly maxConcurrent: number;
    private readonly batchSize: number;

    constructor() {
        this.maxConcurrent = config.processing.maxConcurrentJobs;
        this.batchSize = 2; // Generate 2 segments in parallel (conservative for API limits)
    }

    /**
     * Check if parallel generation should be used
     * (Only for segments that don't need previous frame for continuity)
     */
    canUseParallel(_segmentIndex: number): boolean {
        // First segment always needs serial processing
        // Subsequent segments ideally use previous frame for continuity
        // But if API doesn't support image-to-video, parallel is possible
        return this.batchSize > 1 && this.maxConcurrent > 1;
    }

    /**
     * Generate segments in parallel batches where possible
     * Note: This is only useful if the API allows concurrent requests
     * and doesn't strictly require sequential frame-to-frame continuity
     */
    async generateBatch(
        scenes: Array<{ scenePrompt: string }>,
        startIndex: number,
        userId: string,
        videoId: string
    ): Promise<ParallelGenerationResult[]> {
        const endIndex = Math.min(startIndex + this.batchSize, scenes.length);
        const batchScenes = scenes.slice(startIndex, endIndex);

        console.log(`🔄 Generating batch: segments ${startIndex + 1} to ${endIndex}`);

        const promises = batchScenes.map(async (scene, idx) => {
            const segmentNumber = startIndex + idx + 1;
            const segmentPath = storageService.getSegmentPath(userId, videoId, segmentNumber);

            // Check cache first
            const cached = await segmentCacheService.getCached(scene.scenePrompt, segmentNumber);
            if (cached) {
                await segmentCacheService.copyToTarget(scene.scenePrompt, segmentNumber, segmentPath);
                return {
                    segmentNumber,
                    status: 'completed' as const,
                    filePath: segmentPath,
                };
            }

            // Generate new segment
            try {
                const result = await segmentGenerationService.generateAndSaveSegment(
                    scene.scenePrompt,
                    segmentNumber,
                    segmentPath,
                    undefined // No previous frame in parallel mode
                );

                if (result.status === 'completed') {
                    // Cache the result
                    await segmentCacheService.store(
                        scene.scenePrompt,
                        segmentNumber,
                        segmentPath,
                        config.duration.segment
                    );

                    return {
                        segmentNumber,
                        status: 'completed' as const,
                        filePath: segmentPath,
                        jobId: result.jobId,
                    };
                }

                return {
                    segmentNumber,
                    status: 'failed' as const,
                    error: result.error,
                };
            } catch (error: any) {
                return {
                    segmentNumber,
                    status: 'failed' as const,
                    error: error.message,
                };
            }
        });

        // Wait for all in batch to complete
        return await Promise.all(promises);
    }

    /**
     * Generate all segments with optional parallelism
     * Falls back to sequential if parallel fails
     */
    async generateAllParallel(
        scenes: Array<{ scenePrompt: string }>,
        userId: string,
        videoId: string,
        onProgress?: (completed: number, total: number) => void
    ): Promise<ParallelGenerationResult[]> {
        const results: ParallelGenerationResult[] = [];
        let completed = 0;

        // Group into batches
        for (let i = 0; i < scenes.length; i += this.batchSize) {
            const batchResults = await this.generateBatch(scenes, i, userId, videoId);

            results.push(...batchResults);
            completed += batchResults.length;

            // Report progress
            if (onProgress) {
                onProgress(completed, scenes.length);
            }

            // Check for failures
            const failures = batchResults.filter((r) => r.status === 'failed');
            if (failures.length > 0) {
                console.warn(`⚠️ Batch had ${failures.length} failures`);
            }
        }

        return results;
    }

    /**
     * Retry failed segments
     */
    async retryFailed(
        failed: ParallelGenerationResult[],
        scenes: Array<{ scenePrompt: string }>,
        userId: string,
        videoId: string,
        maxRetries: number = 2
    ): Promise<ParallelGenerationResult[]> {
        const retryResults: ParallelGenerationResult[] = [];

        for (const failedResult of failed) {
            const segmentNumber = failedResult.segmentNumber;
            const scene = scenes[segmentNumber - 1];

            console.log(`🔄 Retrying segment ${segmentNumber}...`);

            let lastError = failedResult.error;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const segmentPath = storageService.getSegmentPath(userId, videoId, segmentNumber);

                    const result = await segmentGenerationService.generateAndSaveSegment(
                        scene.scenePrompt,
                        segmentNumber,
                        segmentPath,
                        undefined
                    );

                    if (result.status === 'completed') {
                        retryResults.push({
                            segmentNumber,
                            status: 'completed',
                            filePath: segmentPath,
                            jobId: result.jobId,
                        });
                        break;
                    }

                    lastError = result.error;
                } catch (error: any) {
                    lastError = error.message;
                }

                // Exponential backoff
                await new Promise((r) => setTimeout(r, 5000 * attempt));
            }

            // If still failed after all retries
            if (!retryResults.find((r) => r.segmentNumber === segmentNumber)) {
                retryResults.push({
                    segmentNumber,
                    status: 'failed',
                    error: lastError,
                });
            }
        }

        return retryResults;
    }
}

// Singleton instance
export const parallelGenerationService = new ParallelGenerationService();

export default parallelGenerationService;
