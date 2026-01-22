import { z } from 'zod';

// ==========================================
// Zod Validation Schemas
// ==========================================

// Auth Schemas
export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
    token: z.string().min(1, 'Token is required'),
});

// Scene Schema for custom scenes
const sceneSchema = z.object({
    sceneNumber: z.number().min(1),
    scenePrompt: z.string().min(1).max(2000),
    visualDescription: z.string().max(2000).optional(),
    continuityNotes: z.string().max(1000).optional(),
    narrationText: z.string().max(500).optional(),
    transitionType: z.enum(['crossfade', 'cut']).optional(),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
});

// Video Schemas
export const createVideoSchema = z.object({
    prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(5000),
    originalPrompt: z.string().min(1).max(2000).optional(),
    duration: z.number()
        .min(5, 'Duration must be at least 5 seconds')
        .max(120, 'Duration cannot exceed 120 seconds'),
    voiceId: z.string().optional(),
    scenes: z.array(sceneSchema).optional(),
});

export const updateVideoSchema = z.object({
    title: z.string().min(1).max(200).optional(),
});

// Prompt Schemas
export const enhancePromptSchema = z.object({
    prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(5000),
    duration: z.number().min(5).max(120).optional().default(90),
});

export const decomposePromptSchema = z.object({
    prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(5000),
    duration: z.number()
        .min(5, 'Duration must be at least 5 seconds')
        .max(120, 'Duration cannot exceed 120 seconds'),
});

// Pagination Schema
export const paginationSchema = z.object({
    page: z.coerce.number().min(1).optional().default(1),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// ID Parameter Schema
export const idParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type EnhancePromptInput = z.infer<typeof enhancePromptSchema>;
export type DecomposePromptInput = z.infer<typeof decomposePromptSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
