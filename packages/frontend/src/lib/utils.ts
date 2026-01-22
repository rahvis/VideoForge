import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ==========================================
// Utility Functions
// ==========================================

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatTimeAgo(date: string | Date): string {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
}

export function getStatusColor(status: string): string {
    switch (status) {
        case 'completed':
            return 'text-[var(--color-success)]';
        case 'failed':
            return 'text-[var(--color-error)]';
        case 'generating':
        case 'processing':
        case 'decomposing':
        case 'stitching':
        case 'audio':
        case 'merging':
        case 'transcoding':
            return 'text-[var(--color-accent-primary)]';
        default:
            return 'text-[var(--color-text-muted)]';
    }
}

export function getPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
        decomposing: 'Breaking into scenes...',
        generating: 'Generating video segments...',
        stitching: 'Stitching video together...',
        audio: 'Creating narration...',
        merging: 'Adding audio to video...',
        transcoding: 'Finalizing...',
        completed: 'Complete!',
        failed: 'Failed',
        pending: 'Waiting to start...',
    };
    return labels[phase] || phase;
}
