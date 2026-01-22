import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

// ==========================================
// Security Utilities
// ==========================================

/**
 * Validate and sanitize file paths to prevent directory traversal
 */
export function validatePath(userPath: string, basePath: string): string | null {
    // Normalize and resolve the path
    const normalizedBase = path.resolve(basePath);
    const resolvedPath = path.resolve(normalizedBase, userPath);

    // Check if resolved path is within base directory
    if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
        return null; // Directory traversal attempt
    }

    return resolvedPath;
}

/**
 * Allowed file extensions for different categories
 */
const ALLOWED_EXTENSIONS = {
    video: ['.mp4', '.webm', '.mov'],
    audio: ['.mp3', '.wav', '.m4a'],
    image: ['.jpg', '.jpeg', '.png', '.webp'],
};

/**
 * Validate file type based on extension
 */
export function validateFileType(
    filePath: string,
    category: keyof typeof ALLOWED_EXTENSIONS
): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ALLOWED_EXTENSIONS[category].includes(ext);
}

/**
 * Validate that a user owns a specific resource
 */
export function validateUserOwnership(resourceUserId: string, requestUserId: string): boolean {
    return resourceUserId === requestUserId;
}

/**
 * Sanitize filename to prevent injection
 */
export function sanitizeFilename(filename: string): string {
    // Remove path separators and null bytes
    return filename
        .replace(/[/\\]/g, '')
        .replace(/\0/g, '')
        .replace(/\.\./g, '')
        .trim();
}

// ==========================================
// Security Middleware
// ==========================================

/**
 * Middleware to validate file path in params
 */
export function validateFilePath(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const filePath = req.params.filePath || req.params.path;

        if (!filePath) {
            return next();
        }

        const validPath = validatePath(filePath, baseDir);

        if (!validPath) {
            res.status(403).json({
                success: false,
                error: 'Invalid file path',
            });
            return;
        }

        // Attach validated path to request
        req.validatedPath = validPath;
        next();
    };
}

/**
 * Middleware to ensure user owns the requested video
 */
export function requireVideoOwnership() {
    return async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.userId;
        const videoId = req.params.id || req.params.videoId;

        if (!userId || !videoId) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }

        // Import Video model dynamically to avoid circular deps
        const { Video } = await import('../models/index.js');

        const video = await Video.findById(videoId);

        if (!video) {
            res.status(404).json({
                success: false,
                error: 'Video not found',
            });
            return;
        }

        if (!validateUserOwnership(video.userId.toString(), userId)) {
            res.status(403).json({
                success: false,
                error: 'Access denied',
            });
            return;
        }

        // Attach video to request for downstream use
        req.video = video;
        next();
    };
}

// ==========================================
// Disk Space Monitoring
// ==========================================

interface DiskSpaceInfo {
    available: number;
    total: number;
    used: number;
    percentUsed: number;
}

/**
 * Get disk space info for the upload directory
 */
export async function getDiskSpaceInfo(): Promise<DiskSpaceInfo> {
    try {
        const { execSync } = await import('child_process');
        const uploadDir = path.resolve(config.uploadDir);

        // Use df command on Unix systems
        const output = execSync(`df -k "${uploadDir}"`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n');

        if (lines.length < 2) {
            throw new Error('Unable to parse df output');
        }

        const parts = lines[1].split(/\s+/);
        const total = parseInt(parts[1], 10) * 1024; // KB to bytes
        const used = parseInt(parts[2], 10) * 1024;
        const available = parseInt(parts[3], 10) * 1024;
        const percentUsed = (used / total) * 100;

        return { available, total, used, percentUsed };
    } catch {
        // Fallback for systems where df is not available
        return {
            available: 100 * 1024 * 1024 * 1024, // 100GB default
            total: 500 * 1024 * 1024 * 1024,
            used: 400 * 1024 * 1024 * 1024,
            percentUsed: 80,
        };
    }
}

/**
 * Check if there's enough disk space for a video
 */
export async function hasEnoughDiskSpace(requiredBytes: number): Promise<boolean> {
    const info = await getDiskSpaceInfo();
    // Keep 10GB buffer
    const bufferBytes = 10 * 1024 * 1024 * 1024;
    return info.available > (requiredBytes + bufferBytes);
}

/**
 * Estimate disk space needed for a video
 * ~50MB per 12-second segment + audio + final outputs
 */
export function estimateRequiredSpace(durationSeconds: number): number {
    const segmentCount = Math.ceil(durationSeconds / 12);
    const segmentSize = 50 * 1024 * 1024; // 50MB per segment
    const audioSize = 5 * 1024 * 1024; // 5MB for audio
    const finalOutputs = 100 * 1024 * 1024; // 100MB for final outputs

    return (segmentCount * segmentSize) + audioSize + finalOutputs;
}

// ==========================================
// Express Type Extensions
// ==========================================

declare global {
    namespace Express {
        interface Request {
            validatedPath?: string;
            video?: any;
        }
    }
}
