// ==========================================
// VideoForge - Database Models
// ==========================================

export { User, type IUser, type UserModel } from './user.model.js';

export {
    Video,
    type IVideo,
    type VideoModel,
    type IScene,
    type IVideoSegment,
    type IVideoFile,
    type IVideoFiles,
    type IVideoMetadata,
    type VideoStatus,
    type SegmentStatus,
    type TransitionType,
} from './video.model.js';

export {
    ProcessingLock,
    LOCK_KEYS,
    type IProcessingLock,
    type IProcessingLockMetadata,
    type ProcessingLockModel,
} from './processing-lock.model.js';
