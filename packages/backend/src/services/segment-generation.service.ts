import { config } from '../config/index.js';
import fs from 'fs/promises';

// ==========================================
// Segment Generation Service (Azure Sora)
// ==========================================

interface SoraJobResponse {
    id: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    created_at: string;
    error?: {
        code: string;
        message: string;
    };
}

interface SoraJobResult {
    id: string;
    status: 'pending' | 'running' | 'succeeded' | 'failed';
    generations?: Array<{
        id: string;
        video_url: string;
    }>;
    error?: {
        code: string;
        message: string;
    };
}

interface SegmentGenerationResult {
    jobId: string;
    status: 'pending' | 'completed' | 'failed';
    videoBuffer?: Buffer;
    error?: string;
}

export class SegmentGenerationService {
    private readonly apiKey: string;
    private readonly endpoint: string;
    private readonly pollingIntervalMs: number;
    private readonly segmentTimeoutMs: number;

    constructor() {
        this.apiKey = config.azure.apiKey;
        this.endpoint = config.azure.endpoint;
        this.pollingIntervalMs = config.processing.pollingIntervalMs;
        this.segmentTimeoutMs = config.processing.segmentTimeoutMs;
    }

    /**
     * Start a video segment generation job
     */
    async startSegmentGeneration(
        scenePrompt: string,
        segmentNumber: number,
        previousFramePath?: string,
        duration?: number
    ): Promise<{ jobId: string }> {
        console.log(`🎥 Starting segment ${segmentNumber} generation`);

        // Enhance prompt with continuity context if we have a previous frame
        let enhancedPrompt = scenePrompt;
        if (previousFramePath) {
            enhancedPrompt += ' [Continue seamlessly from the previous scene with visual continuity]';
        }

        const url = `${this.endpoint}openai/v1/video/generations/jobs?api-version=${config.azure.apiVersion}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-key': this.apiKey,
                },
                body: JSON.stringify({
                    model: config.azure.modelSora,
                    prompt: enhancedPrompt,
                    height: '1080',
                    width: '1920',
                    n_seconds: String(duration || config.duration.segment),
                    n_variants: '1',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Sora API start job failed:`, errorText);
                throw new Error(`Sora API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json() as SoraJobResponse;
            console.log(`✅ Segment ${segmentNumber} job started: ${result.id}`);
            console.log(`📝 Full Sora response:`, JSON.stringify(result, null, 2));

            return { jobId: result.id };
        } catch (error: any) {
            console.error(`❌ Failed to start segment ${segmentNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Check the status of a generation job
     */
    async checkJobStatus(jobId: string): Promise<SoraJobResult> {
        const url = `${this.endpoint}openai/v1/video/generations/jobs/${jobId}?api-version=${config.azure.apiVersion}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Api-key': this.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Status check failed for job ${jobId}:`, errorText);
            throw new Error(`Status check failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as SoraJobResult;
        console.log(`📊 Job ${jobId} status: ${result.status}`);
        return result;
    }

    /**
     * Poll for job completion and download the video
     */
    async pollForCompletion(
        jobId: string,
        segmentNumber: number
    ): Promise<SegmentGenerationResult> {
        const maxAttempts = Math.ceil(this.segmentTimeoutMs / this.pollingIntervalMs);

        console.log(`⏳ Polling segment ${segmentNumber} (max ${maxAttempts} attempts)`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.checkJobStatus(jobId);

                // Match "succeeded" status from example
                if (result.status === 'succeeded') {
                    const generations = result.generations ?? [];
                    console.log(`🎉 Segment ${segmentNumber} SUCCEEDED! Generations:`, JSON.stringify(generations, null, 2));
                    if (generations.length > 0) {
                        const generationId = generations[0].id;
                        console.log(`✅ Segment ${segmentNumber} succeeded. Generation ID: ${generationId}`);

                        // Construct authorized content URL as per example
                        // endpoint/openai/v1/video/generations/{generationId}/content/video?api-version={version}
                        const contentUrl = `${this.endpoint}openai/v1/video/generations/${generationId}/content/video?api-version=${config.azure.apiVersion}`;

                        // Download the video with auth headers
                        const videoBuffer = await this.downloadVideo(contentUrl);

                        return {
                            jobId,
                            status: 'completed',
                            videoBuffer,
                        };
                    } else {
                        console.warn(`⚠️ Segment ${segmentNumber} succeeded but no generations returned`);
                        return {
                            jobId,
                            status: 'failed',
                            error: 'No generations returned',
                        };
                    }
                }

                if (result.status === 'failed') {
                    const errorMsg = result.error?.message || 'Unknown error';
                    console.error(`❌ Segment ${segmentNumber} failed: ${errorMsg}`);

                    return {
                        jobId,
                        status: 'failed',
                        error: errorMsg,
                    };
                }

                // Still pending/running, wait and continue
                if (attempt < maxAttempts) {
                    await this.sleep(this.pollingIntervalMs);
                }
            } catch (error: any) {
                console.error(`⚠️ Poll attempt ${attempt} failed:`, error.message);

                if (attempt === maxAttempts) {
                    return {
                        jobId,
                        status: 'failed',
                        error: `Polling failed: ${error.message}`,
                    };
                }

                await this.sleep(this.pollingIntervalMs);
            }
        }

        return {
            jobId,
            status: 'failed',
            error: 'Segment generation timeout',
        };
    }

    /**
     * Download video from authorized URL
     */
    private async downloadVideo(videoUrl: string): Promise<Buffer> {
        console.log(`📥 Downloading video segment from: ${videoUrl}`);

        const response = await fetch(videoUrl, {
            headers: {
                'Api-key': this.apiKey, // Auth header required for content download
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Download failed:`, errorText);
            throw new Error(`Video download failed: ${response.status}`);
        }

        console.log(`✅ Download successful, getting buffer...`);
        const arrayBuffer = await response.arrayBuffer();
        console.log(`📦 Video buffer size: ${arrayBuffer.byteLength} bytes`);
        return Buffer.from(arrayBuffer);
    }

    /**
     * Generate a segment and save to file
     * @param onJobStarted - Optional callback called immediately after job starts with the jobId
     */
    async generateAndSaveSegment(
        scenePrompt: string,
        segmentNumber: number,
        outputPath: string,
        previousFramePath?: string,
        duration?: number,
        onJobStarted?: (jobId: string) => void | Promise<void>
    ): Promise<SegmentGenerationResult> {
        // Start the job
        const { jobId } = await this.startSegmentGeneration(
            scenePrompt,
            segmentNumber,
            previousFramePath,
            duration
        );

        // Call the callback immediately with the jobId so it can be saved
        if (onJobStarted) {
            try {
                await onJobStarted(jobId);
                console.log(`📝 Job ID ${jobId} reported via callback`);
            } catch (error: any) {
                console.error(`⚠️ Failed to report job ID: ${error.message}`);
            }
        }

        // Poll for completion
        const result = await this.pollForCompletion(jobId, segmentNumber);

        // Save to file if successful
        if (result.status === 'completed' && result.videoBuffer) {
            await fs.writeFile(outputPath, result.videoBuffer);
            console.log(`💾 Segment ${segmentNumber} saved to ${outputPath}`);
        }

        return result;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const segmentGenerationService = new SegmentGenerationService();

export default segmentGenerationService;
