import { Video } from '../models/index.js';

// ==========================================
// Segment Retry Service
// ==========================================

interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 2000, // 2 seconds
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
};

export class RetryService {
    private config: RetryConfig;

    constructor(config: Partial<RetryConfig> = {}) {
        this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    }

    /**
     * Execute a function with retry logic
     */
    async withRetry<T>(
        fn: () => Promise<T>,
        options: {
            videoId?: string;
            segmentNumber?: number;
            operation?: string;
        } = {}
    ): Promise<T> {
        let lastError: Error | null = null;
        const { videoId, segmentNumber, operation = 'operation' } = options;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;

                const isLastAttempt = attempt === this.config.maxRetries;
                const isRetryable = this.isRetryableError(error);

                if (!isRetryable || isLastAttempt) {
                    // Log failure and update segment status if applicable
                    if (videoId && segmentNumber !== undefined) {
                        await this.markSegmentFailed(videoId, segmentNumber, error.message);
                    }
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
                    this.config.maxDelay
                );

                console.log(
                    `⚠️ ${operation} failed (attempt ${attempt}/${this.config.maxRetries}), ` +
                    `retrying in ${delay}ms: ${error.message}`
                );

                // Update segment retry count
                if (videoId && segmentNumber !== undefined) {
                    await this.incrementRetryCount(videoId, segmentNumber);
                }

                await this.sleep(delay);
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }

    /**
     * Determine if an error is retryable
     */
    private isRetryableError(error: any): boolean {
        const message = error.message?.toLowerCase() || '';
        const code = error.code || '';

        // Network errors
        if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
            return true;
        }

        // Rate limiting
        if (message.includes('rate limit') || message.includes('too many requests')) {
            return true;
        }

        // Service unavailable
        if (message.includes('service unavailable') || message.includes('503')) {
            return true;
        }

        // Timeout
        if (message.includes('timeout')) {
            return true;
        }

        // Gateway errors
        if (message.includes('502') || message.includes('504')) {
            return true;
        }

        return false;
    }

    /**
     * Increment retry count for a segment
     */
    private async incrementRetryCount(videoId: string, segmentNumber: number): Promise<void> {
        await Video.updateOne(
            { _id: videoId, 'segments.segmentNumber': segmentNumber },
            { $inc: { 'segments.$.retryCount': 1 } }
        );
    }

    /**
     * Mark a segment as failed
     */
    private async markSegmentFailed(
        videoId: string,
        segmentNumber: number,
        errorMessage: string
    ): Promise<void> {
        await Video.updateOne(
            { _id: videoId, 'segments.segmentNumber': segmentNumber },
            {
                $set: {
                    'segments.$.status': 'failed',
                    'segments.$.error': errorMessage,
                },
            }
        );

        console.log(`❌ Segment ${segmentNumber} of video ${videoId} marked as failed`);
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Retry a failed segment
     */
    async retryFailedSegment(
        videoId: string,
        segmentNumber: number,
        generateFn: () => Promise<string>
    ): Promise<string> {
        const video = await Video.findById(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        const segment = video.segments?.find((s) => s.segmentNumber === segmentNumber);
        if (!segment) {
            throw new Error('Segment not found');
        }

        if (segment.retryCount >= this.config.maxRetries) {
            throw new Error(`Segment ${segmentNumber} has exceeded max retry attempts`);
        }

        // Reset segment status
        await Video.updateOne(
            { _id: videoId, 'segments.segmentNumber': segmentNumber },
            {
                $set: {
                    'segments.$.status': 'generating',
                    'segments.$.error': null,
                },
            }
        );

        // Retry with retry wrapper
        return this.withRetry(generateFn, {
            videoId,
            segmentNumber,
            operation: `Segment ${segmentNumber} generation`,
        });
    }
}

// Singleton
export const retryService = new RetryService();
export default retryService;
