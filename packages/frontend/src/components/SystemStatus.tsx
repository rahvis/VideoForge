'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Lock, Unlock, Server } from 'lucide-react';

// ==========================================
// System Status Component
// ==========================================

interface SystemStatusData {
    status: string;
    processing: {
        isLocked: boolean;
        lockedBy?: string;
    };
    storage: {
        totalVideos: number;
        totalSizeBytes: number;
    };
}

export function SystemStatus() {
    const [status, setStatus] = useState<SystemStatusData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await api.getSystemStatus();
                if (response.success && response.data) {
                    setStatus(response.data);
                }
            } catch (err) {
                setError('Failed to fetch status');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 10000); // Poll every 10 seconds

        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <div className="glass rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-24"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass rounded-lg p-4">
                <span className="text-[var(--color-error)] text-sm">{error}</span>
            </div>
        );
    }

    const isAvailable = !status?.processing.isLocked;

    return (
        <div className="glass rounded-lg p-4">
            <div className="flex items-center gap-6">
                {/* System Status */}
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            'w-2 h-2 rounded-full',
                            isAvailable ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'
                        )}
                    />
                    <span className="text-sm text-[var(--color-text-secondary)]">
                        {isAvailable ? 'System Available' : 'Processing...'}
                    </span>
                </div>

                {/* Lock Status */}
                <div className="flex items-center gap-2">
                    {isAvailable ? (
                        <Unlock className="w-4 h-4 text-[var(--color-success)]" />
                    ) : (
                        <Lock className="w-4 h-4 text-[var(--color-warning)]" />
                    )}
                    <span className="text-sm text-[var(--color-text-muted)]">
                        {isAvailable ? 'Ready' : 'Busy'}
                    </span>
                </div>

                {/* Video Count */}
                <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">
                        {status?.storage.totalVideos || 0} videos
                    </span>
                </div>
            </div>
        </div>
    );
}
