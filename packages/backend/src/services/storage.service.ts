import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

// ==========================================
// Storage Service
// ==========================================

interface VideoPathsResult {
    videoDir: string;
    segmentsDir: string;
    framesDir: string;
    stitched720p: string;
    final720p: string;
    final480p: string;
    audio: string;
    thumbnail: string;
}

export class StorageService {
    private readonly uploadDir: string;

    constructor() {
        this.uploadDir = path.resolve(config.uploadDir);
    }

    /**
     * Ensure all base upload directories exist
     */
    async ensureBaseDirectories(): Promise<void> {
        const dirs = [
            this.uploadDir,
            path.join(this.uploadDir, 'videos'),
            path.join(this.uploadDir, 'temp'),
            path.join(this.uploadDir, 'temp', 'processing'),
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }

        console.log(`✅ Storage directories initialized: ${this.uploadDir}`);
    }

    /**
     * Create video-specific directories
     */
    async createVideoDirectories(
        userId: string,
        videoId: string
    ): Promise<VideoPathsResult> {
        const videoDir = path.join(this.uploadDir, 'videos', userId, videoId);
        const segmentsDir = path.join(videoDir, 'segments');
        const framesDir = path.join(videoDir, 'frames');

        await fs.mkdir(segmentsDir, { recursive: true });
        await fs.mkdir(framesDir, { recursive: true });

        console.log(`📁 Created video directories: ${videoId}`);

        return {
            videoDir,
            segmentsDir,
            framesDir,
            stitched720p: path.join(videoDir, 'stitched_720p.mp4'),
            final720p: path.join(videoDir, 'final_720p.mp4'),
            final480p: path.join(videoDir, 'final_480p.mp4'),
            audio: path.join(videoDir, 'audio.mp3'),
            thumbnail: path.join(videoDir, 'thumbnail.jpg'),
        };
    }

    /**
     * Get paths for an existing video
     */
    getVideoPaths(userId: string, videoId: string): VideoPathsResult {
        const videoDir = path.join(this.uploadDir, 'videos', userId, videoId);

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
    getSegmentPath(userId: string, videoId: string, segmentNumber: number): string {
        const paddedNumber = String(segmentNumber).padStart(3, '0');
        return path.join(
            this.uploadDir,
            'videos',
            userId,
            videoId,
            'segments',
            `segment_${paddedNumber}.mp4`
        );
    }

    /**
     * Get frame file path
     */
    getFramePath(userId: string, videoId: string, segmentNumber: number): string {
        const paddedNumber = String(segmentNumber).padStart(3, '0');
        return path.join(
            this.uploadDir,
            'videos',
            userId,
            videoId,
            'frames',
            `frame_${paddedNumber}.jpg`
        );
    }

    /**
     * Get all segment paths for a video
     */
    async getExistingSegmentPaths(userId: string, videoId: string): Promise<string[]> {
        const segmentsDir = path.join(this.uploadDir, 'videos', userId, videoId, 'segments');

        try {
            const files = await fs.readdir(segmentsDir);
            const segmentFiles = files
                .filter((f) => f.startsWith('segment_') && f.endsWith('.mp4'))
                .sort();

            return segmentFiles.map((f) => path.join(segmentsDir, f));
        } catch {
            return [];
        }
    }

    /**
     * Get temporary file path
     */
    getTempPath(filename: string): string {
        return path.join(this.uploadDir, 'temp', 'processing', filename);
    }

    /**
     * Delete all files for a video
     */
    async deleteVideoFiles(userId: string, videoId: string): Promise<void> {
        const videoDir = path.join(this.uploadDir, 'videos', userId, videoId);

        try {
            await fs.rm(videoDir, { recursive: true, force: true });
            console.log(`🗑️ Deleted video files: ${videoId}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Get file size in bytes
     */
    async getFileSize(filePath: string): Promise<number> {
        const stats = await fs.stat(filePath);
        return stats.size;
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Generate public URL for a file
     */
    getPublicUrl(filePath: string): string {
        const relativePath = path.relative(this.uploadDir, filePath);
        // Ensure we return a full URL including protocol and host
        const baseUrl = `http://localhost:${config.port}`;
        return `${baseUrl}/uploads/${relativePath.replace(/\\/g, '/')}`;
    }

    /**
     * Clean up old temporary files (older than 1 hour)
     */
    async cleanupTempFiles(maxAgeMs: number = 3600000): Promise<number> {
        const tempDir = path.join(this.uploadDir, 'temp', 'processing');
        const cutoffTime = Date.now() - maxAgeMs;
        let deletedCount = 0;

        try {
            const files = await fs.readdir(tempDir);

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);

                if (stats.mtimeMs < cutoffTime) {
                    await fs.rm(filePath, { force: true });
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} temp files`);
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Temp cleanup error:', error.message);
            }
        }

        return deletedCount;
    }

    /**
     * Get storage usage statistics
     */
    async getStorageStats(): Promise<{
        totalVideos: number;
        totalSize: number;
        tempSize: number;
    }> {
        let totalVideos = 0;
        let totalSize = 0;
        let tempSize = 0;

        // Calculate videos directory size
        try {
            const videosDir = path.join(this.uploadDir, 'videos');
            totalSize = await this.getDirectorySize(videosDir);

            const users = await fs.readdir(videosDir);
            for (const user of users) {
                const userDir = path.join(videosDir, user);
                const stats = await fs.stat(userDir);
                if (stats.isDirectory()) {
                    const videos = await fs.readdir(userDir);
                    totalVideos += videos.length;
                }
            }
        } catch {
            // Directory doesn't exist yet
        }

        // Calculate temp directory size
        try {
            const tempDir = path.join(this.uploadDir, 'temp');
            tempSize = await this.getDirectorySize(tempDir);
        } catch {
            // Directory doesn't exist yet
        }

        return { totalVideos, totalSize, tempSize };
    }

    /**
     * Get directory size recursively
     */
    private async getDirectorySize(dirPath: string): Promise<number> {
        let size = 0;

        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    size += await this.getDirectorySize(fullPath);
                } else {
                    const stats = await fs.stat(fullPath);
                    size += stats.size;
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return size;
    }
}

// Singleton instance
export const storageService = new StorageService();

export default storageService;
