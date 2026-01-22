import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';

// ==========================================
// Segment Cache Service
// ==========================================

interface CacheEntry {
    hash: string;
    filePath: string;
    createdAt: Date;
    expiresAt: Date;
    metadata: {
        scenePrompt: string;
        segmentNumber: number;
        duration: number;
    };
}

interface CacheManifest {
    entries: Record<string, CacheEntry>;
    lastCleanup: Date;
}

export class SegmentCacheService {
    private readonly cacheDir: string;
    private readonly manifestPath: string;
    private readonly maxAgeMs: number;
    private manifest: CacheManifest;

    constructor() {
        this.cacheDir = path.join(config.uploadDir, 'cache', 'segments');
        this.manifestPath = path.join(this.cacheDir, 'manifest.json');
        this.maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.manifest = { entries: {}, lastCleanup: new Date() };
    }

    /**
     * Initialize cache directory and load manifest
     */
    async initialize(): Promise<void> {
        await fs.mkdir(this.cacheDir, { recursive: true });
        await this.loadManifest();

        // Run cleanup if needed (every 24 hours)
        const timeSinceCleanup = Date.now() - new Date(this.manifest.lastCleanup).getTime();
        if (timeSinceCleanup > 24 * 60 * 60 * 1000) {
            await this.cleanup();
        }
    }

    /**
     * Generate a cache key for a scene prompt
     */
    generateCacheKey(scenePrompt: string, segmentNumber: number): string {
        const content = `${scenePrompt}::${segmentNumber}`;
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * Check if a segment is cached
     */
    async isCached(scenePrompt: string, segmentNumber: number): Promise<boolean> {
        const key = this.generateCacheKey(scenePrompt, segmentNumber);
        const entry = this.manifest.entries[key];

        if (!entry) return false;

        // Check if expired
        if (new Date() > new Date(entry.expiresAt)) {
            await this.removeEntry(key);
            return false;
        }

        // Check if file still exists
        try {
            await fs.access(entry.filePath);
            return true;
        } catch {
            await this.removeEntry(key);
            return false;
        }
    }

    /**
     * Get cached segment path
     */
    async getCached(scenePrompt: string, segmentNumber: number): Promise<string | null> {
        const key = this.generateCacheKey(scenePrompt, segmentNumber);
        const entry = this.manifest.entries[key];

        if (!entry) return null;

        // Validate entry
        if (new Date() > new Date(entry.expiresAt)) {
            await this.removeEntry(key);
            return null;
        }

        try {
            await fs.access(entry.filePath);
            console.log(`📦 Cache hit for segment ${segmentNumber}`);
            return entry.filePath;
        } catch {
            await this.removeEntry(key);
            return null;
        }
    }

    /**
     * Store a segment in cache
     */
    async store(
        scenePrompt: string,
        segmentNumber: number,
        sourcePath: string,
        duration: number
    ): Promise<string> {
        const key = this.generateCacheKey(scenePrompt, segmentNumber);
        const ext = path.extname(sourcePath);
        const cachedPath = path.join(this.cacheDir, `${key}${ext}`);

        // Copy file to cache
        await fs.copyFile(sourcePath, cachedPath);

        // Create cache entry
        const entry: CacheEntry = {
            hash: key,
            filePath: cachedPath,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.maxAgeMs),
            metadata: {
                scenePrompt: scenePrompt.substring(0, 200), // Truncate for storage
                segmentNumber,
                duration,
            },
        };

        this.manifest.entries[key] = entry;
        await this.saveManifest();

        console.log(`📦 Cached segment ${segmentNumber} (${key})`);
        return cachedPath;
    }

    /**
     * Copy cached segment to target location
     */
    async copyToTarget(
        scenePrompt: string,
        segmentNumber: number,
        targetPath: string
    ): Promise<boolean> {
        const cachedPath = await this.getCached(scenePrompt, segmentNumber);

        if (!cachedPath) return false;

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(cachedPath, targetPath);

        console.log(`📦 Restored segment ${segmentNumber} from cache`);
        return true;
    }

    /**
     * Remove a cache entry
     */
    private async removeEntry(key: string): Promise<void> {
        const entry = this.manifest.entries[key];

        if (entry) {
            try {
                await fs.unlink(entry.filePath);
            } catch {
                // File may not exist
            }
            delete this.manifest.entries[key];
            await this.saveManifest();
        }
    }

    /**
     * Cleanup expired entries
     */
    async cleanup(): Promise<number> {
        console.log('🧹 Running cache cleanup...');
        let removed = 0;
        const now = new Date();

        for (const [key, entry] of Object.entries(this.manifest.entries)) {
            if (now > new Date(entry.expiresAt)) {
                await this.removeEntry(key);
                removed++;
            }
        }

        this.manifest.lastCleanup = now;
        await this.saveManifest();

        if (removed > 0) {
            console.log(`🧹 Removed ${removed} expired cache entries`);
        }

        return removed;
    }

    /**
     * Clear all cache
     */
    async clearAll(): Promise<void> {
        const entries = Object.keys(this.manifest.entries);

        for (const key of entries) {
            await this.removeEntry(key);
        }

        this.manifest = { entries: {}, lastCleanup: new Date() };
        await this.saveManifest();

        console.log('🧹 Cache cleared');
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        totalEntries: number;
        totalSizeBytes: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    }> {
        const entries = Object.values(this.manifest.entries);
        let totalSize = 0;
        let oldest: Date | null = null;
        let newest: Date | null = null;

        for (const entry of entries) {
            try {
                const stats = await fs.stat(entry.filePath);
                totalSize += stats.size;

                const created = new Date(entry.createdAt);
                if (!oldest || created < oldest) oldest = created;
                if (!newest || created > newest) newest = created;
            } catch {
                // File may not exist
            }
        }

        return {
            totalEntries: entries.length,
            totalSizeBytes: totalSize,
            oldestEntry: oldest,
            newestEntry: newest,
        };
    }

    /**
     * Load manifest from disk
     */
    private async loadManifest(): Promise<void> {
        try {
            const content = await fs.readFile(this.manifestPath, 'utf-8');
            this.manifest = JSON.parse(content);
        } catch {
            this.manifest = { entries: {}, lastCleanup: new Date() };
        }
    }

    /**
     * Save manifest to disk
     */
    private async saveManifest(): Promise<void> {
        await fs.writeFile(
            this.manifestPath,
            JSON.stringify(this.manifest, null, 2)
        );
    }
}

// Singleton instance
export const segmentCacheService = new SegmentCacheService();

export default segmentCacheService;
