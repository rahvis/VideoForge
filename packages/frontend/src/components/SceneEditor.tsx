'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Volume2 } from 'lucide-react';

// ==========================================
// Scene Type Definition
// ==========================================

export interface Scene {
    sceneNumber: number;
    scenePrompt: string;
    visualDescription?: string;
    continuityNotes?: string;
    narrationText?: string;
    transitionType: 'crossfade' | 'cut';
    startTime: number;
    endTime: number;
}

interface SceneEditorProps {
    scenes: Scene[];
    onScenesChange: (scenes: Scene[]) => void;
}

// ==========================================
// Scene Editor Component
// ==========================================

export function SceneEditor({ scenes, onScenesChange }: SceneEditorProps) {
    const [expandedScene, setExpandedScene] = useState<number | null>(0);

    const handleSceneChange = (index: number, field: keyof Scene, value: string) => {
        const updated = [...scenes];
        updated[index] = { ...updated[index], [field]: value };
        onScenesChange(updated);
    };

    const toggleExpand = (index: number) => {
        setExpandedScene(expandedScene === index ? null : index);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    Edit Scenes ({scenes.length})
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Customize prompts and narration for each scene
                </p>
            </div>

            <div className="space-y-3">
                {scenes.map((scene, index) => (
                    <div
                        key={scene.sceneNumber}
                        className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] transition-all duration-200"
                    >
                        {/* Scene Header - Always Visible */}
                        <button
                            onClick={() => toggleExpand(index)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)] text-sm font-semibold">
                                    {scene.sceneNumber}
                                </span>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                        Scene {scene.sceneNumber}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {scene.endTime - scene.startTime}s • {scene.transitionType}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {scene.narrationText && (
                                    <Volume2 className="w-4 h-4 text-[var(--color-accent-secondary)]" />
                                )}
                                {expandedScene === index ? (
                                    <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                                )}
                            </div>
                        </button>

                        {/* Expanded Content */}
                        {expandedScene === index && (
                            <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)]">
                                {/* Scene Prompt */}
                                <div className="pt-4">
                                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                        <Edit3 className="w-4 h-4" />
                                        Visual Prompt
                                    </label>
                                    <textarea
                                        value={scene.scenePrompt}
                                        onChange={(e) =>
                                            handleSceneChange(index, 'scenePrompt', e.target.value)
                                        }
                                        rows={3}
                                        className="input resize-none text-sm"
                                        placeholder="Describe what should appear in this scene..."
                                    />
                                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                        {scene.scenePrompt.length}/2000 characters
                                    </p>
                                </div>

                                {/* Narration Text */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                        <Volume2 className="w-4 h-4" />
                                        Narration Text
                                    </label>
                                    <textarea
                                        value={scene.narrationText || ''}
                                        onChange={(e) =>
                                            handleSceneChange(index, 'narrationText', e.target.value)
                                        }
                                        rows={2}
                                        className="input resize-none text-sm"
                                        placeholder="What should be spoken during this scene..."
                                    />
                                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                        {(scene.narrationText || '').length}/500 characters • ~{Math.ceil((scene.narrationText || '').split(' ').filter(Boolean).length / 2.5)}s when spoken
                                    </p>
                                </div>

                                {/* Visual Description (Optional) */}
                                {scene.visualDescription && (
                                    <div className="text-sm text-[var(--color-text-muted)] p-3 rounded-lg bg-[var(--color-bg-tertiary)]">
                                        <span className="font-medium">Visual Notes:</span>{' '}
                                        {scene.visualDescription}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SceneEditor;
