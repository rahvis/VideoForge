import { Router, type IRouter } from 'express';
import { validate, authenticate, asyncHandler } from '../middleware/index.js';
import { enhancePromptSchema, decomposePromptSchema } from '../validators/index.js';
import { promptService, sceneDecompositionService } from '../services/index.js';

// ==========================================
// Prompt Routes
// ==========================================

const router: IRouter = Router();

/**
 * POST /api/prompts/enhance
 * Enhance a user prompt with GPT-4o
 */
router.post(
    '/enhance',
    authenticate,
    validate(enhancePromptSchema),
    asyncHandler(async (req, res) => {
        const { prompt, duration } = req.body;

        const result = await promptService.enhancePrompt(prompt, duration);

        res.json({
            success: true,
            data: {
                originalPrompt: prompt,
                enhancedPrompt: result.enhancedPrompt,
                title: result.title,
                keywords: result.keywords,
                estimatedDuration: result.estimatedDuration,
                segmentCount: Math.ceil(duration / 12),
            },
        });
    })
);

/**
 * POST /api/prompts/decompose
 * Preview scene decomposition before video creation
 */
router.post(
    '/decompose',
    authenticate,
    validate(decomposePromptSchema),
    asyncHandler(async (req, res) => {
        const { prompt, duration } = req.body;

        const result = await sceneDecompositionService.decomposePrompt(prompt, duration);

        res.json({
            success: true,
            data: {
                prompt,
                targetDuration: result.totalDuration,
                segmentCount: result.segmentCount,
                segmentDuration: 12,
                scenes: result.scenes.map((scene) => ({
                    sceneNumber: scene.sceneNumber,
                    scenePrompt: scene.scenePrompt,
                    visualDescription: scene.visualDescription,
                    continuityNotes: scene.continuityNotes,
                    narrationText: scene.narrationText || '',
                    transitionType: scene.transitionType,
                    startTime: scene.startTime,
                    endTime: scene.endTime,
                    duration: (scene.endTime || 0) - (scene.startTime || 0),
                })),
            },
        });
    })
);

export default router;
