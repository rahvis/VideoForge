import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

const execAsync = promisify(exec);

// ==========================================
// Video Stitching Service (FFmpeg)
// ==========================================

interface StitchingOptions {
    fadeDuration?: number;
    outputCodec?: string;
    outputPreset?: string;
    outputCrf?: number;
}

export class VideoStitchingService {
    private readonly defaultFadeDuration: number;
    private readonly segmentDuration: number;
    private readonly ffmpegPath: string;

    constructor() {
        this.defaultFadeDuration = 0.5; // 0.5 second crossfade
        this.segmentDuration = config.duration.segment;
        this.ffmpegPath = '/opt/homebrew/bin/ffmpeg';
    }

    /**
     * Stitch multiple video segments with crossfade transitions
     */
    async stitchWithCrossfade(
        segmentPaths: string[],
        outputPath: string,
        options: StitchingOptions = {}
    ): Promise<string> {
        const {
            fadeDuration = this.defaultFadeDuration,
            outputCodec = 'libx264',
            outputPreset = 'medium',
            outputCrf = 23,
        } = options;

        console.log(`🔗 Stitching ${segmentPaths.length} segments with crossfade`);

        if (segmentPaths.length === 0) {
            throw new Error('No segments to stitch');
        }

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        if (segmentPaths.length === 1) {
            // Single segment, just copy with re-encoding
            await execAsync(
                `${this.ffmpegPath} -y -i "${segmentPaths[0]}" -c:v ${outputCodec} -preset ${outputPreset} -crf ${outputCrf} "${outputPath}"`
            );
            console.log(`✅ Single segment copied to ${path.basename(outputPath)}`);
            return outputPath;
        }

        try {
            // Build FFmpeg command with xfade filters
            const inputs = segmentPaths.map((p) => `-i "${p}"`).join(' ');
            const filterComplex = this.buildCrossfadeFilter(
                segmentPaths.length,
                fadeDuration
            );

            const command = `${this.ffmpegPath} -y ${inputs} -filter_complex "${filterComplex}" -map "[final]" -c:v ${outputCodec} -preset ${outputPreset} -crf ${outputCrf} "${outputPath}"`;

            console.log('🎬 Running FFmpeg stitching...');
            await execAsync(command);

            // Verify output
            await fs.access(outputPath);
            console.log(`✅ Stitched video created: ${path.basename(outputPath)}`);

            return outputPath;
        } catch (error: any) {
            console.error('❌ Video stitching failed:', error.message);
            throw new Error(`Video stitching failed: ${error.message}`);
        }
    }

    /**
     * Simple concatenation without transitions (faster)
     */
    async concatenateSimple(
        segmentPaths: string[],
        outputPath: string
    ): Promise<string> {
        console.log(`🔗 Concatenating ${segmentPaths.length} segments (simple)`);

        if (segmentPaths.length === 0) {
            throw new Error('No segments to concatenate');
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Create concat list file
        const listPath = `${outputPath}.concat.txt`;
        const listContent = segmentPaths.map((p) => `file '${p}'`).join('\n');
        await fs.writeFile(listPath, listContent);

        try {
            // Use concat demuxer for lossless concatenation
            await execAsync(
                `${this.ffmpegPath} -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`
            );

            // Cleanup list file
            await fs.unlink(listPath).catch(() => { });

            console.log(`✅ Concatenated video: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            await fs.unlink(listPath).catch(() => { });
            throw new Error(`Concatenation failed: ${error.message}`);
        }
    }

    /**
     * Build FFmpeg xfade filter graph for crossfade transitions
     */
    private buildCrossfadeFilter(
        segmentCount: number,
        fadeDuration: number
    ): string {
        if (segmentCount <= 1) {
            return '[0:v]copy[final]';
        }

        let filter = '';
        let lastOutput = '[0:v]';

        for (let i = 1; i < segmentCount; i++) {
            const isLast = i === segmentCount - 1;
            const outputLabel = isLast ? '[final]' : `[v${i}]`;

            // Calculate offset: each segment is segmentDuration seconds,
            // minus the accumulated fade overlap
            const offset = i * this.segmentDuration - i * fadeDuration;

            filter += `${lastOutput}[${i}:v]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}${outputLabel}`;

            if (!isLast) {
                filter += ';';
            }

            lastOutput = outputLabel;
        }

        return filter;
    }

    /**
     * Merge audio track with video
     */
    async mergeAudioVideo(
        videoPath: string,
        audioPath: string,
        outputPath: string,
        options: { trimToShortest?: boolean } = {}
    ): Promise<string> {
        const { trimToShortest = true } = options;

        console.log(`🎵 Merging audio with video`);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        try {
            const shortestFlag = trimToShortest ? '-shortest' : '';

            await execAsync(
                `${this.ffmpegPath} -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k ${shortestFlag} "${outputPath}"`
            );

            console.log(`✅ Audio merged: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            throw new Error(`Audio-video merge failed: ${error.message}`);
        }
    }

    /**
     * Transcode video to different resolution
     */
    async transcodeResolution(
        inputPath: string,
        outputPath: string,
        width: number,
        height: number,
        options: StitchingOptions = {}
    ): Promise<string> {
        const {
            outputCodec = 'libx264',
            outputPreset = 'medium',
            outputCrf = 23,
        } = options;

        console.log(`📐 Transcoding to ${width}x${height}`);

        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        try {
            await execAsync(
                `${this.ffmpegPath} -y -i "${inputPath}" -vf "scale=${width}:${height}" -c:v ${outputCodec} -preset ${outputPreset} -crf ${outputCrf} -c:a copy "${outputPath}"`
            );

            console.log(`✅ Transcoded: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            throw new Error(`Transcoding failed: ${error.message}`);
        }
    }

    /**
     * Create multiple resolution versions
     */
    async createMultipleResolutions(
        inputPath: string,
        outputDir: string,
        baseName: string
    ): Promise<{ resolution: string; path: string }[]> {
        const resolutions = [
            { name: '720p', width: 1280, height: 720 },
            { name: '480p', width: 854, height: 480 },
        ];

        const results: { resolution: string; path: string }[] = [];

        for (const res of resolutions) {
            const outputPath = path.join(outputDir, `${baseName}_${res.name}.mp4`);
            await this.transcodeResolution(inputPath, outputPath, res.width, res.height);
            results.push({ resolution: res.name, path: outputPath });
        }

        return results;
    }
}

// Singleton instance
export const videoStitchingService = new VideoStitchingService();

export default videoStitchingService;
