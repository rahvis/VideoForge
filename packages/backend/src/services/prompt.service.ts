import OpenAI from 'openai';
import { config } from '../config/index.js';

// ==========================================
// Prompt Enhancement Service
// ==========================================

interface EnhancedPromptResult {
    enhancedPrompt: string;
    title: string;
    keywords: string[];
    estimatedDuration: number;
}

export class PromptService {
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
     * Enhance a user prompt for better video generation
     */
    async enhancePrompt(
        originalPrompt: string,
        targetDuration: number
    ): Promise<EnhancedPromptResult> {
        console.log('🔮 Enhancing prompt with GPT-4o');

        const systemPrompt = `You are an expert at crafting prompts for AI video generation.
Your task is to enhance a user's video concept into a detailed, cinematic prompt that will produce stunning visuals.

Guidelines for enhancement:
1. Add specific visual details (lighting, camera angles, colors, atmosphere)
2. Include motion and action descriptions
3. Specify the style/mood (cinematic, documentary, artistic, etc.)
4. Maintain the user's original intent
5. Make it vivid and descriptive but not overly long
6. Consider the video duration (${targetDuration} seconds) for pacing

Return your response as a valid JSON object:
{
  "enhancedPrompt": "Your detailed, enhanced prompt here",
  "title": "A short, catchy title for the video (max 50 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "estimatedDuration": ${targetDuration}
}`;

        const userPrompt = `Please enhance this video concept for a ${targetDuration}-second AI-generated video:

"${originalPrompt}"`;

        try {
            const response = await this.client.chat.completions.create({
                model: config.azure.deployment,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.8,
                max_tokens: 1500,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from GPT-4o');
            }

            const result = JSON.parse(content);

            console.log(`✅ Prompt enhanced: "${result.title}"`);

            return {
                enhancedPrompt: result.enhancedPrompt || originalPrompt,
                title: result.title || this.generateDefaultTitle(originalPrompt),
                keywords: result.keywords || [],
                estimatedDuration: result.estimatedDuration || targetDuration,
            };
        } catch (error: any) {
            console.error('❌ Prompt enhancement failed:', error.message);

            // Return original prompt as fallback
            return {
                enhancedPrompt: originalPrompt,
                title: this.generateDefaultTitle(originalPrompt),
                keywords: [],
                estimatedDuration: targetDuration,
            };
        }
    }

    /**
     * Generate a narration script for the video
     */
    async generateNarrationScript(
        enhancedPrompt: string,
        scenes: { sceneNumber: number; scenePrompt: string }[],
        targetDuration: number
    ): Promise<string> {
        console.log('📝 Generating narration script');

        const sceneDescriptions = scenes
            .map((s) => `Scene ${s.sceneNumber}: ${s.scenePrompt}`)
            .join('\n\n');

        const systemPrompt = `You are a professional scriptwriter for video narration.
Create a compelling narration script that matches the video scenes.

Guidelines:
1. The narration should be ${targetDuration} seconds when spoken (approximately ${Math.round(targetDuration * 2.5)} words)
2. Match the pacing to each scene
3. Use engaging, professional language
4. Insert [SCENE BREAK] between each scene's narration for timing
5. Start with a hook and end with a memorable conclusion
6. The narration should complement the visuals, not describe them literally`;

        const userPrompt = `Create narration for this video (${targetDuration} seconds, ${scenes.length} scenes):

Video Concept: ${enhancedPrompt}

Scenes:
${sceneDescriptions}

Return ONLY the narration script with [SCENE BREAK] between sections.`;

        try {
            const response = await this.client.chat.completions.create({
                model: config.azure.deployment,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            });

            const script = response.choices[0]?.message?.content || '';
            console.log(`✅ Narration script generated (${script.length} chars)`);

            return script;
        } catch (error: any) {
            console.error('❌ Narration script generation failed:', error.message);
            throw new Error(`Narration generation failed: ${error.message}`);
        }
    }

    /**
     * Generate a default title from the prompt
     */
    private generateDefaultTitle(prompt: string): string {
        const words = prompt.split(' ').slice(0, 6);
        return words.join(' ').substring(0, 50);
    }
}

// Singleton instance
export const promptService = new PromptService();

export default promptService;
