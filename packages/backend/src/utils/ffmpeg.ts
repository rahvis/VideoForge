import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FFmpegInfo {
    available: boolean;
    version: string | null;
    path: string | null;
    codecs: {
        h264: boolean;
        aac: boolean;
        mp3: boolean;
    };
    filters: {
        concat: boolean;
        xfade: boolean;
    };
}

/**
 * Check if FFmpeg is installed and get its capabilities
 */
export async function checkFFmpeg(): Promise<FFmpegInfo> {
    const info: FFmpegInfo = {
        available: false,
        version: null,
        path: null,
        codecs: {
            h264: false,
            aac: false,
            mp3: false,
        },
        filters: {
            concat: false,
            xfade: false,
        },
    };

    try {
        // Check FFmpeg version
        const { stdout: versionOutput } = await execAsync('ffmpeg -version');
        const versionMatch = versionOutput.match(/ffmpeg version (\S+)/);
        info.version = versionMatch ? versionMatch[1] : 'unknown';
        info.available = true;

        // Get FFmpeg path
        const { stdout: pathOutput } = await execAsync('which ffmpeg');
        info.path = pathOutput.trim();

        // Check for H.264 encoder
        const { stdout: encodersOutput } = await execAsync('ffmpeg -encoders 2>/dev/null');
        info.codecs.h264 = encodersOutput.includes('libx264');
        info.codecs.aac = encodersOutput.includes('aac');
        info.codecs.mp3 = encodersOutput.includes('libmp3lame') || encodersOutput.includes('mp3');

        // Check for required filters
        const { stdout: filtersOutput } = await execAsync('ffmpeg -filters 2>/dev/null');
        info.filters.concat = filtersOutput.includes('concat');
        info.filters.xfade = filtersOutput.includes('xfade');

        console.log('✅ FFmpeg detected:', info.version);
        console.log(`   Path: ${info.path}`);
        console.log(`   H.264: ${info.codecs.h264 ? '✓' : '✗'}`);
        console.log(`   AAC: ${info.codecs.aac ? '✓' : '✗'}`);
        console.log(`   Concat: ${info.filters.concat ? '✓' : '✗'}`);
        console.log(`   XFade: ${info.filters.xfade ? '✓' : '✗'}`);

    } catch (error) {
        console.error('❌ FFmpeg not found. Please install FFmpeg.');
        console.error('   macOS: brew install ffmpeg');
        console.error('   Ubuntu: sudo apt install ffmpeg');
        console.error('   Windows: choco install ffmpeg');
    }

    return info;
}

/**
 * Extract the last frame from a video for continuity
 */
export async function extractLastFrame(
    videoPath: string,
    outputPath: string
): Promise<string> {
    // Extract the very last frame of the video
    await execAsync(`
    ffmpeg -y -sseof -0.1 -i "${videoPath}" \
      -vframes 1 -q:v 2 \
      "${outputPath}"
  `);
    return outputPath;
}

/**
 * Get video duration in seconds
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
    const { stdout } = await execAsync(`
    ffprobe -v error -show_entries format=duration \
      -of default=noprint_wrappers=1:nokey=1 "${videoPath}"
  `);
    return parseFloat(stdout.trim());
}

/**
 * Stitch multiple video segments with crossfade transitions
 */
export async function stitchVideosWithCrossfade(
    segmentPaths: string[],
    outputPath: string,
    fadeDuration: number = 0.5,
    segmentDuration: number = 12
): Promise<string> {
    if (segmentPaths.length === 0) {
        throw new Error('No segments to stitch');
    }

    if (segmentPaths.length === 1) {
        // Single segment, just copy
        await execAsync(`ffmpeg -y -i "${segmentPaths[0]}" -c copy "${outputPath}"`);
        return outputPath;
    }

    // Build input arguments
    const inputs = segmentPaths.map(p => `-i "${p}"`).join(' ');

    // Build xfade filter chain
    let filterComplex = '';
    let lastOutput = '[0:v]';

    for (let i = 1; i < segmentPaths.length; i++) {
        const offset = (i * segmentDuration) - (i * fadeDuration);
        const outputLabel = i === segmentPaths.length - 1 ? '[final]' : `[v${i}]`;

        filterComplex += `${lastOutput}[${i}:v]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}${outputLabel}`;

        if (i < segmentPaths.length - 1) {
            filterComplex += ';';
        }
        lastOutput = outputLabel;
    }

    // Execute FFmpeg with crossfade
    await execAsync(`
    ffmpeg -y ${inputs} \
      -filter_complex "${filterComplex}" \
      -map "[final]" \
      -c:v libx264 -preset medium -crf 23 \
      "${outputPath}"
  `);

    return outputPath;
}

/**
 * Simple concatenation without transitions (faster)
 */
export async function concatenateVideos(
    segmentPaths: string[],
    outputPath: string,
    listFilePath: string
): Promise<string> {
    // Create concat list file
    const listContent = segmentPaths.map(p => `file '${p}'`).join('\n');
    const fs = await import('fs/promises');
    await fs.writeFile(listFilePath, listContent);

    // Concatenate using concat demuxer
    await execAsync(`
    ffmpeg -y -f concat -safe 0 -i "${listFilePath}" \
      -c copy "${outputPath}"
  `);

    // Clean up list file
    await fs.unlink(listFilePath);

    return outputPath;
}

/**
 * Merge audio with video
 */
export async function mergeAudioVideo(
    videoPath: string,
    audioPath: string,
    outputPath: string
): Promise<string> {
    await execAsync(`
    ffmpeg -y -i "${videoPath}" -i "${audioPath}" \
      -c:v copy -c:a aac -shortest \
      "${outputPath}"
  `);
    return outputPath;
}

/**
 * Transcode video to different resolution
 */
export async function transcodeResolution(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number
): Promise<string> {
    await execAsync(`
    ffmpeg -y -i "${inputPath}" \
      -vf "scale=${width}:${height}" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k \
      "${outputPath}"
  `);
    return outputPath;
}

/**
 * Generate thumbnail from video
 */
export async function generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = 1
): Promise<string> {
    await execAsync(`
    ffmpeg -y -ss ${timestamp} -i "${videoPath}" \
      -vframes 1 -q:v 2 \
      "${outputPath}"
  `);
    return outputPath;
}

export default {
    checkFFmpeg,
    extractLastFrame,
    getVideoDuration,
    stitchVideosWithCrossfade,
    concatenateVideos,
    mergeAudioVideo,
    transcodeResolution,
    generateThumbnail,
};
