'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DurationSlider } from '@/components/DurationSlider';
import { SceneEditor, type Scene } from '@/components/SceneEditor';
import { api } from '@/lib/api';
import { Eye, Loader2, AlertCircle, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';

// ==========================================
// Create Video Page - Multi-Step Wizard
// ==========================================

type Step = 'prompt' | 'scenes';

export default function CreateVideoPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('prompt');

    // Form state
    const [prompt, setPrompt] = useState('');
    const [duration, setDuration] = useState(90);
    const [scenes, setScenes] = useState<Scene[]>([]);

    // Loading states
    const [isLoading, setIsLoading] = useState(false);
    const [isDecomposing, setIsDecomposing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Preview and go to scene editor
    const handlePreviewScenes = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        setIsDecomposing(true);
        setError(null);

        try {
            const response = await api.decomposeScenes(prompt, duration);
            if (response.success && response.data) {
                setScenes(response.data.scenes as Scene[]);
                setStep('scenes');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to generate scenes');
        } finally {
            setIsDecomposing(false);
        }
    };

    // Generate video without previewing scenes
    const handleQuickGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.createVideo(prompt, duration);
            if (response.success && response.data) {
                router.push(`/videos/${response.data.id}/progress`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create video');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Create video with custom scenes
    const handleCreateWithScenes = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.createVideo(prompt, duration, undefined, scenes);
            if (response.success && response.data) {
                router.push(`/videos/${response.data.id}/progress`);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create video');
        } finally {
            setIsLoading(false);
        }
    };

    const goBack = () => {
        setStep('prompt');
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl font-semibold text-[var(--color-text-primary)] mb-2">
                    Create Video
                </h1>
                <p className="text-[var(--color-text-secondary)]">
                    Transform your ideas into stunning 60-120 second videos with AI
                </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-4 mb-8">
                <div className={`flex items-center gap-2 ${step === 'prompt' ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'prompt' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}`}>
                        1
                    </span>
                    <span className="text-sm font-medium">Describe</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className={`flex items-center gap-2 ${step === 'scenes' ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'scenes' ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-bg-tertiary)]'}`}>
                        2
                    </span>
                    <span className="text-sm font-medium">Edit Scenes</span>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)] mb-6">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Step 1: Prompt & Duration */}
            {step === 'prompt' && (
                <div className="space-y-6">
                    {/* Prompt Input */}
                    <div className="card">
                        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-3">
                            Describe your video
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A majestic eagle soaring over snow-capped mountain peaks at golden hour, with dramatic clouds and sun rays piercing through..."
                            rows={5}
                            className="input resize-none"
                        />
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                            Be descriptive! Include visual elements, mood, timing, and any specific scenes you want.
                        </p>
                    </div>

                    {/* Duration Slider */}
                    <div className="card">
                        <DurationSlider value={duration} onChange={setDuration} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={handleQuickGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className="btn btn-secondary"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            Quick Generate
                        </button>

                        <button
                            onClick={handlePreviewScenes}
                            disabled={isDecomposing || !prompt.trim()}
                            className="btn btn-primary"
                        >
                            {isDecomposing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Eye className="w-4 h-4" />
                                    Customize Scenes
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Scene Editor */}
            {step === 'scenes' && (
                <div className="space-y-6">
                    {/* Scene Editor Component */}
                    <div className="card">
                        <SceneEditor scenes={scenes} onScenesChange={setScenes} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={goBack}
                            className="btn btn-secondary"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>

                        <button
                            onClick={handleCreateWithScenes}
                            disabled={isLoading}
                            className="btn btn-primary"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            Generate Video
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
