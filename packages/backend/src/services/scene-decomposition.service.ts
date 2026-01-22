import OpenAI from 'openai';
import { config } from '../config/index.js';
import type { IScene } from '../models/index.js';

// ==========================================
// Scene Decomposition Service
// ==========================================

interface SceneDecompositionResult {
    scenes: IScene[];
    totalDuration: number;
    segmentCount: number;
}

export class SceneDecompositionService {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: config.azure.apiKey,
            baseURL: `${config.azure.endpoint}openai/deployments/${config.azure.deployment}`,
            defaultQuery: { 'api-version': config.azure.apiVersionGpt },
            defaultHeaders: { 'api-key': config.azure.apiKey },
        });
    }

    /**
     * Decompose a prompt into sequential scenes for video generation
     */
    async decomposePrompt(
        prompt: string,
        targetDuration: number
    ): Promise<SceneDecompositionResult> {
        // Use 5 second segments for 5 second videos (testing), otherwise 12 seconds
        const segmentDuration = targetDuration === 5 ? 5 : config.duration.segment;
        const segmentCount = Math.ceil(targetDuration / segmentDuration);

        console.log(`🎬 Decomposing prompt into ${segmentCount} scenes (${targetDuration}s total, ${segmentDuration}s/segment)`);

        const systemPrompt = `You are a professional video storyboard artist and cinematographer.
Your task is to break down a video concept into exactly ${segmentCount} sequential scenes of ${segmentDuration} seconds each.

For each scene, provide:
1. sceneNumber: The scene number (1 to ${segmentCount})
2. scenePrompt: A detailed visual description for AI video generation (camera angle, lighting, action, subjects, environment)
3. visualDescription: Additional artistic notes about mood, color palette, and composition
4. continuityNotes: What visual elements carry over from the previous scene to ensure seamless transitions
5. narrationText: A short narration script (15-25 words) to be spoken during this scene. Should complement the visuals.
6. transitionType: Either "crossfade" (smooth blend) or "cut" (direct transition)
7. startTime: When this scene starts (in seconds)
8. endTime: When this scene ends (in seconds)

Guidelines:
- Maintain visual and narrative continuity across all scenes
- Each scene should flow naturally into the next
- The first scene should establish the setting
- The final scene should provide a satisfying conclusion
- Keep descriptions vivid but concise (max 200 words per scene)
- Narration should be engaging and complement visuals, not describe them literally
- Prefer "crossfade" transitions for smoother video stitching

Return your response as a valid JSON object with this exact structure:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "scenePrompt": "...",
      "visualDescription": "...",
      "continuityNotes": "...",
      "narrationText": "...",
      "transitionType": "crossfade",
      "startTime": 0,
      "endTime": ${segmentDuration}
    }
  ]
}`;


        const userPrompt = `Please decompose the following video concept into ${segmentCount} scenes:

${prompt}

Remember:
- Total video duration: ${targetDuration} seconds
- Each scene: ${segmentDuration} seconds
- Total scenes: ${segmentCount}`;

        try {
            const response = await this.client.chat.completions.create({
                model: config.azure.deployment,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 4000,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from GPT-4o');
            }

            const parsed = JSON.parse(content);
            const scenes = this.validateAndTransformScenes(parsed.scenes, segmentCount, segmentDuration);

            console.log(`✅ Successfully decomposed into ${scenes.length} scenes`);

            return {
                scenes,
                totalDuration: targetDuration,
                segmentCount,
            };
        } catch (error: any) {
            console.error('❌ Scene decomposition failed:', error.message);
            throw new Error(`Scene decomposition failed: ${error.message}`);
        }
    }

    /**
     * Validate and transform scenes from GPT response
     */
    private validateAndTransformScenes(
        rawScenes: any[],
        expectedCount: number,
        segmentDuration: number
    ): IScene[] {
        if (!Array.isArray(rawScenes)) {
            throw new Error('Invalid scenes format: expected array');
        }

        if (rawScenes.length !== expectedCount) {
            console.warn(`⚠️ Expected ${expectedCount} scenes, got ${rawScenes.length}`);
        }

        return rawScenes.map((scene, index) => ({
            sceneNumber: scene.sceneNumber || index + 1,
            scenePrompt: scene.scenePrompt || scene.prompt || '',
            visualDescription: scene.visualDescription || '',
            continuityNotes: scene.continuityNotes || '',
            narrationText: scene.narrationText || '',
            startTime: scene.startTime ?? index * segmentDuration,
            endTime: scene.endTime ?? (index + 1) * segmentDuration,
            transitionType: scene.transitionType === 'cut' ? 'cut' : 'crossfade',
        }));
    }

    /**
     * Generate a simple fallback decomposition if GPT fails
     */
    generateFallbackScenes(
        prompt: string,
        targetDuration: number
    ): SceneDecompositionResult {
        const segmentDuration = targetDuration === 5 ? 5 : config.duration.segment;
        const segmentCount = Math.ceil(targetDuration / segmentDuration);

        console.warn('⚠️ Using fallback scene decomposition');

        const scenes: IScene[] = [];
        for (let i = 0; i < segmentCount; i++) {
            scenes.push({
                sceneNumber: i + 1,
                scenePrompt: `${prompt} - Scene ${i + 1} of ${segmentCount}`,
                visualDescription: '',
                continuityNotes: i > 0 ? 'Continue from previous scene' : '',
                startTime: i * segmentDuration,
                endTime: (i + 1) * segmentDuration,
                transitionType: 'crossfade',
            });
        }

        return {
            scenes,
            totalDuration: targetDuration,
            segmentCount,
        };
    }
}

// Singleton instance
export const sceneDecompositionService = new SceneDecompositionService();

export default sceneDecompositionService;
