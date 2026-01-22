import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Type Definitions
// ==========================================

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

// ==========================================
// Sub-document Interfaces
// ==========================================

export interface IScene {
    sceneNumber: number;
    scenePrompt: string;
    visualDescription?: string;
    continuityNotes?: string;
    narrationText?: string;
    startTime: number;
    endTime: number;
    transitionType: TransitionType;
}

export interface IVideoSegment {
    segmentNumber: number;
    soraJobId?: string;
    status: SegmentStatus;
    filePath?: string;
    lastFramePath?: string;
    duration?: number;
    retryCount: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
}

export interface IVideoFile {
    path: string;
    url: string;
    size: number;
    format: string;
    duration?: number;
}

export interface IVideoFiles {
    stitched_720p?: IVideoFile;
    final_720p?: IVideoFile;
    final_480p?: IVideoFile;
    audio?: IVideoFile;
    thumbnail?: IVideoFile;
}

export interface IVideoMetadata {
    resolution?: string;
    fps?: number;
    codec?: string;
    bitrate?: number;
    voiceId?: string;
    voiceName?: string;
}

// ==========================================
// Main Video Interface
// ==========================================

export interface IVideo extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    title: string;
    originalPrompt: string;
    enhancedPrompt?: string;

    // Extended Duration Settings
    targetDuration: number;
    actualDuration?: number;
    segmentCount: number;
    segmentDuration: number;

    // Scene Decomposition
    scenes: IScene[];

    // Processing Status
    status: VideoStatus;
    progress: number;
    currentPhase?: string;
    currentSegment: number;
    errorMessage?: string;

    // Segment References
    segments: IVideoSegment[];

    // Final Files
    files: IVideoFiles;

    // Metadata
    metadata: IVideoMetadata;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;

    // Virtual
    estimatedTimeRemaining?: number;
}

export type VideoModel = Model<IVideo>;

// ==========================================
// Sub-Schemas
// ==========================================

const sceneSchema = new Schema<IScene>(
    {
        sceneNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        scenePrompt: {
            type: String,
            required: true,
            maxlength: 2000,
        },
        visualDescription: {
            type: String,
            maxlength: 2000,
        },
        continuityNotes: {
            type: String,
            maxlength: 1000,
        },
        narrationText: {
            type: String,
            maxlength: 500,
        },
        startTime: {
            type: Number,
            required: true,
            min: 0,
        },
        endTime: {
            type: Number,
            required: true,
            min: 0,
        },
        transitionType: {
            type: String,
            enum: ['crossfade', 'cut'],
            default: 'crossfade',
        },
    },
    { _id: false }
);

const segmentSchema = new Schema<IVideoSegment>(
    {
        segmentNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        soraJobId: {
            type: String,
        },
        status: {
            type: String,
            enum: ['pending', 'generating', 'completed', 'failed'],
            default: 'pending',
        },
        filePath: {
            type: String,
        },
        lastFramePath: {
            type: String,
        },
        duration: {
            type: Number,
            min: 0,
        },
        retryCount: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        error: {
            type: String,
        },
        startedAt: {
            type: Date,
        },
        completedAt: {
            type: Date,
        },
    },
    { _id: false }
);

const videoFileSchema = new Schema<IVideoFile>(
    {
        path: {
            type: String,
            required: true,
        },
        url: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            required: true,
            min: 0,
        },
        format: {
            type: String,
            required: true,
        },
        duration: {
            type: Number,
            min: 0,
        },
    },
    { _id: false }
);

const videoFilesSchema = new Schema<IVideoFiles>(
    {
        stitched_720p: videoFileSchema,
        final_720p: videoFileSchema,
        final_480p: videoFileSchema,
        audio: videoFileSchema,
        thumbnail: videoFileSchema,
    },
    { _id: false }
);

const videoMetadataSchema = new Schema<IVideoMetadata>(
    {
        resolution: String,
        fps: Number,
        codec: String,
        bitrate: Number,
        voiceId: String,
        voiceName: String,
    },
    { _id: false }
);

// ==========================================
// Main Video Schema
// ==========================================

const videoSchema = new Schema<IVideo, VideoModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        originalPrompt: {
            type: String,
            required: [true, 'Original prompt is required'],
            maxlength: [5000, 'Prompt cannot exceed 5000 characters'],
        },
        enhancedPrompt: {
            type: String,
            maxlength: [10000, 'Enhanced prompt cannot exceed 10000 characters'],
        },

        // Extended Duration Settings
        targetDuration: {
            type: Number,
            required: [true, 'Target duration is required'],
            min: [5, 'Minimum duration is 5 seconds'],
            max: [120, 'Maximum duration is 120 seconds'],
        },
        actualDuration: {
            type: Number,
            min: 0,
        },
        segmentCount: {
            type: Number,
            required: true,
            min: [1, 'Minimum 1 segment for short video'],
            max: [10, 'Maximum 10 segments for 120-second video'],
        },
        segmentDuration: {
            type: Number,
            default: 12,
            min: 1,
            max: 20,
        },

        // Scene Decomposition
        scenes: {
            type: [sceneSchema],
            default: [],
        },

        // Processing Status
        status: {
            type: String,
            enum: [
                'pending',
                'decomposing',
                'generating',
                'stitching',
                'audio',
                'merging',
                'transcoding',
                'completed',
                'failed',
            ],
            default: 'pending',
            index: true,
        },
        progress: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        currentPhase: {
            type: String,
        },
        currentSegment: {
            type: Number,
            default: 0,
            min: 0,
        },
        errorMessage: {
            type: String,
        },

        // Segment References
        segments: {
            type: [segmentSchema],
            default: [],
        },

        // Final Files
        files: {
            type: videoFilesSchema,
            default: {},
        },

        // Metadata
        metadata: {
            type: videoMetadataSchema,
            default: {},
        },

        // Completion timestamp
        completedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (_doc, ret) => {
                const { __v, ...rest } = ret;
                return rest;
            },
        },
    }
);

// ==========================================
// Indexes for Performance
// ==========================================

// Compound index for user's videos sorted by creation date
videoSchema.index({ userId: 1, createdAt: -1 });

// Index for finding videos by status
videoSchema.index({ status: 1, createdAt: -1 });

// Index for finding incomplete videos (for recovery)
videoSchema.index({ status: 1, updatedAt: 1 });

// Compound index for user + status queries
videoSchema.index({ userId: 1, status: 1 });

// ==========================================
// Virtual Properties
// ==========================================

videoSchema.virtual('completedSegments').get(function () {
    return this.segments.filter((s) => s.status === 'completed').length;
});

videoSchema.virtual('failedSegments').get(function () {
    return this.segments.filter((s) => s.status === 'failed').length;
});

videoSchema.virtual('isProcessing').get(function () {
    return !['pending', 'completed', 'failed'].includes(this.status);
});

// ==========================================
// Pre-save Hook
// ==========================================

videoSchema.pre('save', function (next) {
    // Auto-calculate segment count based on duration
    if (this.isModified('targetDuration') && !this.isModified('segmentCount')) {
        this.segmentCount = Math.ceil(this.targetDuration / this.segmentDuration);
    }

    // Initialize segments array if needed
    if (this.segments.length === 0 && this.segmentCount > 0) {
        for (let i = 1; i <= this.segmentCount; i++) {
            this.segments.push({
                segmentNumber: i,
                status: 'pending',
                retryCount: 0,
            });
        }
    }

    // Set completedAt when status changes to completed
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    next();
});

// ==========================================
// Static Methods
// ==========================================

videoSchema.statics.findByUserId = function (userId: string) {
    return this.find({ userId }).sort({ createdAt: -1 });
};

videoSchema.statics.findIncomplete = function () {
    return this.find({
        status: { $nin: ['completed', 'failed', 'pending'] },
    }).sort({ updatedAt: 1 });
};

// ==========================================
// Export Model
// ==========================================

export const Video = mongoose.model<IVideo, VideoModel>('Video', videoSchema);

export default Video;
