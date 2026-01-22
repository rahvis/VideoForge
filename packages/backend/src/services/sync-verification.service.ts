import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// ==========================================
// Audio-Video Sync Verification Service
// ==========================================

interface SyncAnalysis {
    isInSync: boolean;
    videoDuration: number;
    audioDuration: number;
    durationDifference: number;
    maxAllowedDifference: number;
    recommendation: string;
}

interface MediaInfo {
    duration: number;
    format: string;
    bitrate?: number;
    channels?: number;
    sampleRate?: number;
}

export class SyncVerificationService {
    private readonly maxDifferenceSeconds = 2; // Allow 2 seconds max difference

    /**
     * Verify audio-video synchronization
     */
    async verifySynchronization(
        videoPath: string,
        audioPath: string
    ): Promise<SyncAnalysis> {
        console.log('🔍 Verifying audio-video synchronization...');

        const [videoInfo, audioInfo] = await Promise.all([
            this.getMediaDuration(videoPath),
            this.getMediaDuration(audioPath),
        ]);

        const difference = Math.abs(videoInfo.duration - audioInfo.duration);
        const isInSync = difference <= this.maxDifferenceSeconds;

        let recommendation = '';
        if (!isInSync) {
            if (audioInfo.duration > videoInfo.duration) {
                recommendation = `Audio is ${difference.toFixed(1)}s longer. Consider speed adjustment or trimming.`;
            } else {
                recommendation = `Video is ${difference.toFixed(1)}s longer. Audio may need padding or looping.`;
            }
        } else {
            recommendation = 'Audio and video are within acceptable sync tolerance.';
        }

        const result: SyncAnalysis = {
            isInSync,
            videoDuration: videoInfo.duration,
            audioDuration: audioInfo.duration,
            durationDifference: difference,
            maxAllowedDifference: this.maxDifferenceSeconds,
            recommendation,
        };

        if (isInSync) {
            console.log(`✅ Sync verified: video=${videoInfo.duration.toFixed(1)}s, audio=${audioInfo.duration.toFixed(1)}s`);
        } else {
            console.warn(`⚠️ Sync issue: ${recommendation}`);
        }

        return result;
    }

    /**
     * Get media file duration
     */
    async getMediaDuration(filePath: string): Promise<MediaInfo> {
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration,format_name,bit_rate -show_entries stream=channels,sample_rate -of json "${filePath}"`
            );

            const data = JSON.parse(stdout);
            const format = data.format || {};
            const stream = data.streams?.[0] || {};

            return {
                duration: parseFloat(format.duration || '0'),
                format: format.format_name || 'unknown',
                bitrate: format.bit_rate ? parseInt(format.bit_rate) : undefined,
                channels: stream.channels,
                sampleRate: stream.sample_rate ? parseInt(stream.sample_rate) : undefined,
            };
        } catch (error: any) {
            throw new Error(`Failed to get media info: ${error.message}`);
        }
    }

    /**
     * Adjust audio duration to match video
     */
    async adjustAudioDuration(
        audioPath: string,
        targetDuration: number,
        outputPath: string
    ): Promise<string> {
        const audioInfo = await this.getMediaDuration(audioPath);
        const difference = targetDuration - audioInfo.duration;

        if (Math.abs(difference) <= 0.5) {
            // Within 0.5 seconds, just copy
            await fs.copyFile(audioPath, outputPath);
            return outputPath;
        }

        if (difference > 0) {
            // Audio is shorter, add silence padding
            console.log(`📎 Adding ${difference.toFixed(1)}s silence to audio`);
            await execAsync(
                `ffmpeg -y -i "${audioPath}" -af "apad=whole_dur=${targetDuration}" -c:a aac "${outputPath}"`
            );
        } else {
            // Audio is longer, speed up slightly
            const speedFactor = audioInfo.duration / targetDuration;
            console.log(`⏩ Speeding up audio by ${((speedFactor - 1) * 100).toFixed(1)}%`);
            await execAsync(
                `ffmpeg -y -i "${audioPath}" -filter:a "atempo=${speedFactor}" -c:a aac "${outputPath}"`
            );
        }

        return outputPath;
    }

    /**
     * Verify final merged video has both audio and video streams
     */
    async verifyMergedFile(filePath: string): Promise<{
        hasVideo: boolean;
        hasAudio: boolean;
        videoCodec?: string;
        audioCodec?: string;
        duration: number;
    }> {
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries stream=codec_type,codec_name -show_entries format=duration -of json "${filePath}"`
            );

            const data = JSON.parse(stdout);
            const streams = data.streams || [];
            const format = data.format || {};

            let hasVideo = false;
            let hasAudio = false;
            let videoCodec: string | undefined;
            let audioCodec: string | undefined;

            for (const stream of streams) {
                if (stream.codec_type === 'video') {
                    hasVideo = true;
                    videoCodec = stream.codec_name;
                }
                if (stream.codec_type === 'audio') {
                    hasAudio = true;
                    audioCodec = stream.codec_name;
                }
            }

            console.log(`📹 Merged file: video=${hasVideo ? videoCodec : 'none'}, audio=${hasAudio ? audioCodec : 'none'}`);

            return {
                hasVideo,
                hasAudio,
                videoCodec,
                audioCodec,
                duration: parseFloat(format.duration || '0'),
            };
        } catch (error: any) {
            throw new Error(`Failed to verify merged file: ${error.message}`);
        }
    }

    /**
     * Check video for corruption or issues
     */
    async validateVideo(videoPath: string): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Try to read the video metadata
            const { stdout, stderr } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate -of json "${videoPath}" 2>&1`
            );

            const data = JSON.parse(stdout);
            const stream = data.streams?.[0];

            if (!stream) {
                errors.push('No video stream found');
            } else {
                // Check resolution
                if (stream.width < 480 || stream.height < 270) {
                    warnings.push(`Low resolution: ${stream.width}x${stream.height}`);
                }

                // Check duration
                const duration = parseFloat(stream.duration || '0');
                if (duration < 10) {
                    warnings.push(`Very short duration: ${duration}s`);
                }
            }

            // Check for errors in stderr
            if (stderr && stderr.includes('error')) {
                warnings.push(`FFprobe warnings: ${stderr.substring(0, 200)}`);
            }

        } catch (error: any) {
            errors.push(`Video validation failed: ${error.message}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
}

// Singleton instance
export const syncVerificationService = new SyncVerificationService();

export default syncVerificationService;
