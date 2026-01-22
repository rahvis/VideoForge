'use client';

import { cn, getPhaseLabel } from '@/lib/utils';
import { Check, Loader2, AlertCircle } from 'lucide-react';

// ==========================================
// Segment Progress Component
// ==========================================

interface Segment {
    segmentNumber: number;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    progress?: number;
}

interface SegmentProgressProps {
    segmentCount: number;
    currentSegment: number;
    segments: Segment[];
    currentPhase?: string;
    overallProgress: number;
}

export function SegmentProgress({
    segmentCount,
    currentSegment,
    segments,
    currentPhase = 'generating',
    overallProgress,
}: SegmentProgressProps) {
    const completedCount = segments.filter((s) => s.status === 'completed').length;
    const failedCount = segments.filter((s) => s.status === 'failed').length;

    return (
        <div className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {getPhaseLabel(currentPhase)}
                    </span>
                    <span className="text-sm text-[var(--color-text-muted)]">
                        {Math.round(overallProgress)}%
                    </span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${overallProgress}%` }}
                    />
                </div>
            </div>

            {/* Segment Grid */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                        Segments
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                        {completedCount}/{segmentCount} complete
                    </span>
                </div>

                <div className="segment-grid">
                    {Array.from({ length: segmentCount }).map((_, i) => {
                        const segment = segments[i];
                        const status = segment?.status || 'pending';
                        const isActive = i + 1 === currentSegment;

                        return (
                            <div
                                key={i}
                                className={cn(
                                    'segment-item',
                                    status,
                                    isActive && status === 'generating' && 'ring-2 ring-[var(--color-accent-primary)]'
                                )}
                            >
                                {status === 'completed' && <Check className="w-4 h-4" />}
                                {status === 'generating' && <Loader2 className="w-4 h-4 animate-spin" />}
                                {status === 'failed' && <AlertCircle className="w-4 h-4" />}
                                {status === 'pending' && <span>{i + 1}</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Status Footer */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[var(--color-progress-complete)]" />
                    <span className="text-[var(--color-text-muted)]">Complete</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[var(--color-progress-active)]" />
                    <span className="text-[var(--color-text-muted)]">Generating</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[var(--color-progress-pending)]" />
                    <span className="text-[var(--color-text-muted)]">Pending</span>
                </div>
                {failedCount > 0 && (
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[var(--color-error)]" />
                        <span className="text-[var(--color-text-muted)]">Failed ({failedCount})</span>
                    </div>
                )}
            </div>
        </div>
    );
}
