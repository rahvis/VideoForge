// ==========================================
// VideoForge - Services
// ==========================================

// Lock Service
export { lockService, LockService } from './lock.service.js';

// AI Services
export { sceneDecompositionService, SceneDecompositionService } from './scene-decomposition.service.js';
export { promptService, PromptService } from './prompt.service.js';
export { segmentGenerationService, SegmentGenerationService } from './segment-generation.service.js';

// Media Processing Services
export { frameExtractionService, FrameExtractionService } from './frame-extraction.service.js';
export { videoStitchingService, VideoStitchingService } from './video-stitching.service.js';
export { audioService, AudioService } from './audio.service.js';

// Storage Service
export { storageService, StorageService } from './storage.service.js';

// Auth & User Services
export { authService, AuthService } from './auth.service.js';
export { userService, UserService } from './user.service.js';

// Main Processing Orchestrator
export { processingService, ProcessingService } from './processing.service.js';

// Phase 4: Processing Pipeline Services
export { segmentCacheService, SegmentCacheService } from './segment-cache.service.js';
export { syncVerificationService, SyncVerificationService } from './sync-verification.service.js';
export { rollbackService, RollbackService } from './rollback.service.js';
export { parallelGenerationService, ParallelGenerationService } from './parallel-generation.service.js';
