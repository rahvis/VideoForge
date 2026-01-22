import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// ==========================================
// Frame Extraction Service (FFmpeg)
// ==========================================

export class FrameExtractionService {
    /**
     * Extract the last frame from a video for visual continuity
     */
    async extractLastFrame(
        videoPath: string,
        outputPath: string
    ): Promise<string> {
        console.log(`🖼️ Extracting last frame from ${path.basename(videoPath)}`);

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        try {
            // Extract the very last frame of the video
            // -sseof -0.1 seeks to 0.1 seconds from end of file
            // -vframes 1 extracts only 1 frame
            // -q:v 2 sets quality (1-31, lower is better)
            await execAsync(
                `ffmpeg -y -sseof -0.1 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`
            );

            // Verify the file was created
            await fs.access(outputPath);

            console.log(`✅ Last frame extracted: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            console.error('❌ Frame extraction failed:', error.message);
            throw new Error(`Frame extraction failed: ${error.message}`);
        }
    }

    /**
     * Extract a frame at a specific timestamp
     */
    async extractFrameAt(
        videoPath: string,
        outputPath: string,
        timestampSeconds: number
    ): Promise<string> {
        console.log(`🖼️ Extracting frame at ${timestampSeconds}s`);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        try {
            await execAsync(
                `ffmpeg -y -ss ${timestampSeconds} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`
            );

            await fs.access(outputPath);
            return outputPath;
        } catch (error: any) {
            throw new Error(`Frame extraction at ${timestampSeconds}s failed: ${error.message}`);
        }
    }

    /**
     * Extract multiple frames evenly distributed across the video
     */
    async extractKeyFrames(
        videoPath: string,
        outputDir: string,
        frameCount: number = 5
    ): Promise<string[]> {
        console.log(`🖼️ Extracting ${frameCount} key frames`);

        await fs.mkdir(outputDir, { recursive: true });

        const duration = await this.getVideoDuration(videoPath);
        const interval = duration / (frameCount + 1);
        const framePaths: string[] = [];

        for (let i = 1; i <= frameCount; i++) {
            const timestamp = interval * i;
            const outputPath = path.join(outputDir, `keyframe_${i.toString().padStart(3, '0')}.jpg`);

            await this.extractFrameAt(videoPath, outputPath, timestamp);
            framePaths.push(outputPath);
        }

        return framePaths;
    }

    /**
     * Generate a thumbnail from the video
     */
    async generateThumbnail(
        videoPath: string,
        outputPath: string,
        timestampSeconds: number = 2
    ): Promise<string> {
        console.log(`🎞️ Generating thumbnail`);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        try {
            // Generate a high-quality thumbnail
            await execAsync(
                `ffmpeg -y -ss ${timestampSeconds} -i "${videoPath}" -vframes 1 -vf "scale=1280:720" -q:v 2 "${outputPath}"`
            );

            await fs.access(outputPath);
            console.log(`✅ Thumbnail generated: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            throw new Error(`Thumbnail generation failed: ${error.message}`);
        }
    }

    /**
     * Get video duration in seconds
     */
    async getVideoDuration(videoPath: string): Promise<number> {
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
            );
            return parseFloat(stdout.trim());
        } catch (error: any) {
            throw new Error(`Failed to get video duration: ${error.message}`);
        }
    }

    /**
     * Get video metadata
     */
    async getVideoMetadata(videoPath: string): Promise<{
        duration: number;
        width: number;
        height: number;
        fps: number;
        codec: string;
    }> {
        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -show_entries format=duration -of json "${videoPath}"`
            );

            const data = JSON.parse(stdout);
            const stream = data.streams?.[0] || {};
            const format = data.format || {};

            // Parse frame rate (e.g., "30/1" -> 30)
            const fpsStr = stream.r_frame_rate || '30/1';
            const [num, den] = fpsStr.split('/').map(Number);
            const fps = den ? num / den : num;

            return {
                duration: parseFloat(format.duration || '0'),
                width: stream.width || 1920,
                height: stream.height || 1080,
                fps: Math.round(fps),
                codec: stream.codec_name || 'h264',
            };
        } catch (error: any) {
            throw new Error(`Failed to get video metadata: ${error.message}`);
        }
    }
}

// Singleton instance
export const frameExtractionService = new FrameExtractionService();

export default frameExtractionService;
