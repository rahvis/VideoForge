'use client';

import { cn, formatTimeAgo } from '@/lib/utils';
import { Play, Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ==========================================
// Video Card Component
// ==========================================

interface VideoCardProps {
    id: string;
    title: string;
    status: string;
    progress: number;
    targetDuration: number;
    thumbnail?: string;
    createdAt: string;
    onDelete?: (id: string) => void;
}

export function VideoCard({
    id,
    title,
    status,
    progress,
    targetDuration,
    thumbnail,
    createdAt,
    onDelete,
}: VideoCardProps) {
    const isProcessing = !['completed', 'failed', 'pending'].includes(status);
    const isCompleted = status === 'completed';

    return (
        <div className="card group">
            {/* Thumbnail */}
            <div className="relative aspect-video rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)] mb-4">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt={title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-12 h-12 text-[var(--color-text-muted)]" />
                    </div>
                )}

                {/* Progress overlay */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                        <div className="text-white text-sm font-medium mb-2">
                            {Math.round(progress)}%
                        </div>
                        <div className="w-3/4 h-1 bg-white/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Play button for completed videos */}
                {isCompleted && (
                    <Link
                        href={`/videos/${id}`}
                        className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                            <Play className="w-5 h-5 text-black ml-1" fill="currentColor" />
                        </div>
                    </Link>
                )}
            </div>

            {/* Content */}
            <div className="space-y-2">
                <div className="flex items-start justify-between">
                    <Link href={`/videos/${id}`} className="flex-1">
                        <h3 className="font-medium text-[var(--color-text-primary)] line-clamp-2 hover:text-[var(--color-accent-primary)] transition-colors">
                            {title}
                        </h3>
                    </Link>
                    {(status === 'completed' || status === 'failed') && onDelete && (
                        <button
                            onClick={() => onDelete(id)}
                            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 text-sm">
                    {/* Status */}
                    <span
                        className={cn(
                            'status-badge',
                            status === 'completed' && 'completed',
                            status === 'failed' && 'failed',
                            isProcessing && 'processing'
                        )}
                    >
                        <span
                            className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                status === 'completed' && 'bg-[var(--color-success)]',
                                status === 'failed' && 'bg-[var(--color-error)]',
                                isProcessing && 'bg-[var(--color-accent-primary)] animate-pulse'
                            )}
                        />
                        {status}
                    </span>

                    {/* Duration */}
                    <span className="text-[var(--color-text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(targetDuration / 60)}:{(targetDuration % 60).toString().padStart(2, '0')}
                    </span>
                </div>

                {/* Created time */}
                <p className="text-xs text-[var(--color-text-muted)]">
                    {formatTimeAgo(createdAt)}
                </p>
            </div>
        </div>
    );
}
