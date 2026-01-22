import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

// ==========================================
// Audio Service (ElevenLabs)
// ==========================================

interface VoiceSettings {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
}

interface AudioGenerationOptions {
    voiceId?: string;
    modelId?: string;
    voiceSettings?: Partial<VoiceSettings>;
}

export class AudioService {
    private readonly apiKey: string;
    private readonly defaultVoiceId: string;
    private readonly defaultModel: string;
    private readonly baseUrl = 'https://api.elevenlabs.io/v1';

    constructor() {
        this.apiKey = config.elevenlabs.apiKey;
        this.defaultVoiceId = config.elevenlabs.voiceId;
        this.defaultModel = config.elevenlabs.model;
    }

    /**
     * Generate audio narration from text
     */
    async generateNarration(
        script: string,
        outputPath: string,
        options: AudioGenerationOptions = {}
    ): Promise<string> {
        const {
            voiceId = this.defaultVoiceId,
            modelId = this.defaultModel,
            voiceSettings = {},
        } = options;

        console.log(`🎙️ Generating narration (${script.length} chars)`);

        // Process script with break tags for scene transitions
        const processedScript = this.processScriptWithBreaks(script);

        const url = `${this.baseUrl}/text-to-speech/${voiceId}`;

        const defaultSettings: VoiceSettings = {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
        };

        const finalSettings = { ...defaultSettings, ...voiceSettings };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey,
                },
                body: JSON.stringify({
                    text: processedScript,
                    model_id: modelId,
                    voice_settings: finalSettings,
                    output_format: 'mp3_44100_128',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
            }

            // Save the audio file
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, buffer);

            console.log(`✅ Audio saved: ${path.basename(outputPath)}`);
            return outputPath;
        } catch (error: any) {
            console.error('❌ Audio generation failed:', error.message);
            throw new Error(`Audio generation failed: ${error.message}`);
        }
    }

    /**
     * Process script to add SSML-like break tags
     */
    private processScriptWithBreaks(script: string): string {
        // Replace [SCENE BREAK] markers with ElevenLabs break syntax
        return script.replace(
            /\[SCENE BREAK\]/gi,
            '<break time="1.0s" />'
        );
    }

    /**
     * Get available voices
     */
    async getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get voices: ${response.status}`);
            }

            const data = await response.json() as { voices: Array<{ voice_id: string; name: string }> };
            return data.voices || [];
        } catch (error: any) {
            console.error('❌ Failed to get voices:', error.message);
            return [];
        }
    }

    /**
     * Check API subscription status
     */
    async getSubscriptionInfo(): Promise<{
        character_count: number;
        character_limit: number;
        can_extend_character_limit: boolean;
    } | null> {
        try {
            const response = await fetch(`${this.baseUrl}/user/subscription`, {
                headers: {
                    'xi-api-key': this.apiKey,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get subscription: ${response.status}`);
            }

            return await response.json() as {
                character_count: number;
                character_limit: number;
                can_extend_character_limit: boolean;
            };
        } catch (error: any) {
            console.error('❌ Failed to get subscription info:', error.message);
            return null;
        }
    }

    /**
     * Estimate audio duration based on text length
     * Average speaking rate: ~150 words per minute = 2.5 words per second
     */
    estimateDuration(text: string): number {
        const wordCount = text.split(/\s+/).length;
        return Math.ceil(wordCount / 2.5);
    }

    /**
     * Generate narration with duration validation
     */
    async generateNarrationWithDurationCheck(
        script: string,
        outputPath: string,
        expectedDuration: number,
        options: AudioGenerationOptions = {}
    ): Promise<{ path: string; estimatedDuration: number }> {
        const estimatedDuration = this.estimateDuration(script);

        // Warn if duration mismatch is significant (>20%)
        const durationDiff = Math.abs(estimatedDuration - expectedDuration) / expectedDuration;
        if (durationDiff > 0.2) {
            console.warn(
                `⚠️ Duration mismatch: expected ${expectedDuration}s, estimated ${estimatedDuration}s`
            );
        }

        const audioPath = await this.generateNarration(script, outputPath, options);

        return {
            path: audioPath,
            estimatedDuration,
        };
    }
}

// Singleton instance
export const audioService = new AudioService();

export default audioService;
