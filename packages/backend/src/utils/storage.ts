import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

/**
 * Upload Directory Structure:
 * 
 * packages/backend/uploads/
 * ├── videos/
 * │   └── {userId}/
 * │       └── {videoId}/
 * │           ├── segments/           # Individual video segments
 * │           │   ├── segment_001.mp4
 * │           │   ├── segment_002.mp4
 * │           │   └── ...
 * │           ├── frames/             # Last frames for continuity
 * │           │   ├── frame_001.jpg
 * │           │   ├── frame_002.jpg
 * │           │   └── ...
 * │           ├── stitched_720p.mp4   # Stitched video (no audio)
 * │           ├── final_720p.mp4      # Final with audio
 * │           ├── final_480p.mp4
 * │           ├── audio.mp3
 * │           └── thumbnail.jpg
 * └── temp/
 *     └── processing/
 */

// Base directories to create
const BASE_DIRECTORIES = [
    '',
    'videos',
    'temp',
    'temp/processing',
];

/**
 * Ensure all required upload directories exist
 */
export async function ensureUploadDirectories(): Promise<void> {
    const uploadDir = path.resolve(config.uploadDir);

    for (const dir of BASE_DIRECTORIES) {
        const fullPath = path.join(uploadDir, dir);
        try {
            await fs.mkdir(fullPath, { recursive: true });
        } catch (error: any) {
            if (error.code !== 'EEXIST') {
                console.error(`Failed to create directory: ${fullPath}`, error);
                throw error;
            }
        }
    }

    console.log(`✅ Upload directories initialized at: ${uploadDir}`);
}

/**
 * Create video-specific directories for a new video
 */
export async function createVideoDirectories(
    userId: string,
    videoId: string
): Promise<{
    videoDir: string;
    segmentsDir: string;
    framesDir: string;
}> {
    const uploadDir = path.resolve(config.uploadDir);
    const videoDir = path.join(uploadDir, 'videos', userId, videoId);
    const segmentsDir = path.join(videoDir, 'segments');
    const framesDir = path.join(videoDir, 'frames');

    await fs.mkdir(videoDir, { recursive: true });
    await fs.mkdir(segmentsDir, { recursive: true });
    await fs.mkdir(framesDir, { recursive: true });

    return {
        videoDir,
        segmentsDir,
        framesDir,
    };
}

/**
 * Get file paths for a video
 */
export function getVideoPaths(userId: string, videoId: string) {
    const uploadDir = path.resolve(config.uploadDir);
    const videoDir = path.join(uploadDir, 'videos', userId, videoId);

    return {
        videoDir,
        segmentsDir: path.join(videoDir, 'segments'),
        framesDir: path.join(videoDir, 'frames'),
        stitched720p: path.join(videoDir, 'stitched_720p.mp4'),
        final720p: path.join(videoDir, 'final_720p.mp4'),
        final480p: path.join(videoDir, 'final_480p.mp4'),
        audio: path.join(videoDir, 'audio.mp3'),
        thumbnail: path.join(videoDir, 'thumbnail.jpg'),
    };
}

/**
 * Get segment file path
 */
export function getSegmentPath(
    userId: string,
    videoId: string,
    segmentNumber: number
): string {
    const uploadDir = path.resolve(config.uploadDir);
    const paddedNumber = String(segmentNumber).padStart(3, '0');
    return path.join(
        uploadDir,
        'videos',
        userId,
        videoId,
        'segments',
        `segment_${paddedNumber}.mp4`
    );
}

/**
 * Get frame file path (for continuity between segments)
 */
export function getFramePath(
    userId: string,
    videoId: string,
    segmentNumber: number
): string {
    const uploadDir = path.resolve(config.uploadDir);
    const paddedNumber = String(segmentNumber).padStart(3, '0');
    return path.join(
        uploadDir,
        'videos',
        userId,
        videoId,
        'frames',
        `frame_${paddedNumber}.jpg`
    );
}

/**
 * Get temporary file path for processing
 */
export function getTempPath(filename: string): string {
    const uploadDir = path.resolve(config.uploadDir);
    return path.join(uploadDir, 'temp', 'processing', filename);
}

/**
 * Delete a video and all its files
 */
export async function deleteVideoFiles(
    userId: string,
    videoId: string
): Promise<void> {
    const { videoDir } = getVideoPaths(userId, videoId);

    try {
        await fs.rm(videoDir, { recursive: true, force: true });
        console.log(`✅ Deleted video files: ${videoDir}`);
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`Failed to delete video files: ${videoDir}`, error);
            throw error;
        }
    }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Clean up old temporary files (older than 1 hour)
 */
export async function cleanupTempFiles(): Promise<void> {
    const tempDir = getTempPath('');
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    try {
        const files = await fs.readdir(tempDir);

        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = await fs.stat(filePath);

            if (stats.mtimeMs < oneHourAgo) {
                await fs.rm(filePath, { force: true });
                console.log(`🗑️ Cleaned up temp file: ${file}`);
            }
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error('Error cleaning up temp files:', error);
        }
    }
}
