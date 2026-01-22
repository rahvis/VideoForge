// ==========================================
// VideoForge - Shared Types
// ==========================================

// User Types
export interface User {
    _id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

// Video Processing Status
export type VideoStatus =
    | 'pending'
    | 'decomposing'
    | 'generating'
    | 'stitching'
    | 'audio'
    | 'merging'
    | 'transcoding'
    | 'completed'
    | 'failed';

export type SegmentStatus = 'pending' | 'generating' | 'completed' | 'failed';

export type TransitionType = 'crossfade' | 'cut';

// Scene Types
export interface Scene {
    sceneNumber: number;
    scenePrompt: string;
    visualDescription: string;
    continuityNotes: string;
    startTime: number;
    endTime: number;
    transitionType: TransitionType;
}

// Segment Types
export interface VideoSegment {
    segmentNumber: number;
    soraJobId: string;
    status: SegmentStatus;
    filePath: string | null;
    lastFramePath: string | null;
    duration: number;
    retryCount: number;
    error?: string;
}

// File Types
export interface VideoFile {
    path: string;
    url: string;
    size: number;
    format: string;
    duration?: number;
}

export interface VideoFiles {
    stitched_720p?: VideoFile;
    final_720p?: VideoFile;
    final_480p?: VideoFile;
    audio?: VideoFile;
    thumbnail?: VideoFile;
}

// Video Metadata
export interface VideoMetadata {
    resolution: string;
    fps: number;
    codec: string;
    bitrate: number;
    voiceId: string;
    voiceName: string;
}

// Main Video Type
export interface Video {
    _id: string;
    userId: string;
    title: string;
    originalPrompt: string;
    enhancedPrompt: string;

    // Extended Duration Settings
    targetDuration: number;
    actualDuration?: number;
    segmentCount: number;
    segmentDuration: number;

    // Scene Decomposition
    scenes: Scene[];

    // Processing Status
    status: VideoStatus;
    progress: number;
    currentPhase: string;
    currentSegment: number;

    // Segment References
    segments: VideoSegment[];

    // Final Files
    files: VideoFiles;

    // Metadata
    metadata: VideoMetadata;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

// Processing Lock Types
export interface ProcessingLock {
    key: string;
    isLocked: boolean;
    lockedBy: string;
    lockedAt: Date;
    expiresAt: Date;
    metadata: {
        videoId?: string;
        userId?: string;
        targetDuration?: number;
        estimatedCompletion?: Date;
    };
}

// API Request/Response Types
export interface CreateVideoRequest {
    prompt: string;
    originalPrompt: string;
    duration: number;
    voiceId?: string;
}

export interface EnhancePromptRequest {
    prompt: string;
}

export interface DecomposePromptRequest {
    prompt: string;
    targetDuration: number;
}

export interface VideoStatusResponse {
    id: string;
    status: VideoStatus;
    progress: number;
    currentPhase: string;
    currentSegment: number;
    segmentCount: number;
    segments: VideoSegment[];
}

export interface SystemStatusResponse {
    isProcessing: boolean;
    isLocked: boolean;
    currentVideoId: string | null;
    estimatedCompletion: Date | null;
}

// Error Types
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

// Environment Configuration
export interface EnvConfig {
    // Database
    MONGODB_URI: string;

    // Azure OpenAI (Sora)
    AZURE_API_KEY: string;
    AZURE_API_VERSION: string;
    AZURE_ENDPOINT: string;
    AZURE_MODEL_NAME: string;
    AZURE_DEPLOYMENT: string;
    AZURE_MODEL_SORA: string;

    // ElevenLabs
    ELEVENLABS_API_KEY: string;
    ELEVENLABS_VOICE_ID: string;
    ELEVENLABS_MODEL: string;

    // Duration Settings
    MIN_VIDEO_DURATION: number;
    MAX_VIDEO_DURATION: number;
    SEGMENT_DURATION: number;
    MAX_SEGMENT_RETRIES: number;

    // Processing
    MAX_CONCURRENT_JOBS: number;
    POLLING_INTERVAL_MS: number;
    VIDEO_TIMEOUT_MS: number;
    SEGMENT_TIMEOUT_MS: number;
    LOCK_TIMEOUT_MS: number;

    // Server
    NODE_ENV: string;
    PORT: number;
    UPLOAD_DIR: string;
}

// Constants
export const DURATION_CONSTRAINTS = {
    MIN_DURATION: 60,
    MAX_DURATION: 120,
    SEGMENT_DURATION: 12,
    CROSSFADE_DURATION: 0.5,
};

export const PROCESSING_PHASES = [
    'decomposing',
    'generating',
    'stitching',
    'audio',
    'merging',
    'transcoding',
    'completed',
] as const;

export const PHASE_PROGRESS = {
    decomposing: { start: 0, end: 5 },
    generating: { start: 5, end: 70 },
    stitching: { start: 70, end: 80 },
    audio: { start: 80, end: 90 },
    merging: { start: 90, end: 95 },
    transcoding: { start: 95, end: 100 },
} as const;
