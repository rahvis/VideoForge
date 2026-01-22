'use client';

import { cn } from '@/lib/utils';

// ==========================================
// Duration Slider Component (5-120 seconds)
// ==========================================

interface DurationSliderProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export function DurationSlider({ value, onChange, disabled = false }: DurationSliderProps) {
    const segmentCount = Math.ceil(value / 12);

    // Format duration display
    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-4">
            {/* Label */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                    Video Duration
                </label>
                <span className="text-lg font-semibold gradient-text">
                    {formatDuration(value)}
                </span>
            </div>

            {/* Slider */}
            <div className="relative">
                <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    disabled={disabled}
                    className="duration-slider"
                />

                {/* Track markers */}
                <div className="flex justify-between px-1 mt-2">
                    <span className="text-xs text-[var(--color-text-muted)]">5s</span>
                    <span className="text-xs text-[var(--color-text-muted)]">1:00</span>
                    <span className="text-xs text-[var(--color-text-muted)]">2:00</span>
                </div>
            </div>

            {/* Segment info */}
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                <span>
                    <span className="font-medium">{segmentCount}</span> segment{segmentCount !== 1 ? 's' : ''} × 12 seconds max
                </span>
                <span className="text-[var(--color-text-muted)]">
                    Total: ~{value}s
                </span>
            </div>

            {/* Visual segment preview */}
            <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex-1 h-2 rounded-full transition-all',
                            i < segmentCount
                                ? 'bg-[var(--color-accent-primary)]'
                                : 'bg-[var(--color-bg-tertiary)]'
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
