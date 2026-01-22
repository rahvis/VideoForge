'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SegmentProgress } from '@/components/SegmentProgress';
import { getPhaseLabel } from '@/lib/utils';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// ==========================================
// Video Progress Page
// ==========================================

interface Segment {
    segmentNumber: number;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    progress: number;
}

export default function VideoProgressPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [status, setStatus] = useState<any>(null);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!videoId) return;

        const fetchStatus = async () => {
            try {
                const [statusRes, segmentsRes] = await Promise.all([
                    api.getVideoStatus(videoId),
                    api.getVideoSegments(videoId),
                ]);

                if (statusRes.success && statusRes.data) {
                    setStatus(statusRes.data);

                    // Redirect to player when complete
                    if (statusRes.data.status === 'completed') {
                        router.push(`/videos/${videoId}`);
                        return;
                    }
                }

                if (segmentsRes.success && segmentsRes.data) {
                    setSegments(segmentsRes.data.segments as Segment[]);
                }
            } catch (error) {
                console.error('Failed to fetch status:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [videoId, router]);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-primary)]" />
            </div>
        );
    }

    const isFailed = status?.status === 'failed';
    const isComplete = status?.status === 'completed';

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            {/* Header */}
            <div className="text-center mb-12">
                {isFailed ? (
                    <>
                        <XCircle className="w-16 h-16 mx-auto text-[var(--color-error)] mb-4" />
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                            Generation Failed
                        </h1>
                        <p className="text-[var(--color-text-secondary)]">
                            Something went wrong during video generation
                        </p>
                    </>
                ) : isComplete ? (
                    <>
                        <CheckCircle className="w-16 h-16 mx-auto text-[var(--color-success)] mb-4" />
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                            Video Complete!
                        </h1>
                        <p className="text-[var(--color-text-secondary)]">
                            Your video is ready to watch
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center mb-4">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-primary)]" />
                        </div>
                        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                            Generating Your Video
                        </h1>
                        <p className="text-[var(--color-text-secondary)]">
                            {getPhaseLabel(status?.currentPhase || 'processing')}
                        </p>
                    </>
                )}
            </div>

            {/* Progress */}
            {!isFailed && (
                <div className="card mb-8">
                    <SegmentProgress
                        segmentCount={status?.segmentCount || 8}
                        currentSegment={status?.currentSegment || 0}
                        segments={segments}
                        currentPhase={status?.currentPhase}
                        overallProgress={status?.progress || 0}
                    />
                </div>
            )}

            {/* Phase Info */}
            {!isFailed && !isComplete && (
                <div className="card">
                    <h3 className="font-medium text-[var(--color-text-primary)] mb-4">
                        Processing Pipeline
                    </h3>
                    <div className="space-y-2">
                        {['decomposing', 'generating', 'stitching', 'audio', 'merging', 'transcoding'].map(
                            (phase, i) => (
                                <div
                                    key={phase}
                                    className={`flex items-center gap-3 p-3 rounded-lg ${status?.currentPhase === phase
                                        ? 'bg-[var(--color-accent-primary)]/10'
                                        : 'opacity-50'
                                        }`}
                                >
                                    <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${status?.currentPhase === phase
                                            ? 'bg-[var(--color-accent-primary)] text-white'
                                            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
                                            }`}
                                    >
                                        {i + 1}
                                    </div>
                                    <span className="text-sm text-[var(--color-text-primary)]">
                                        {getPhaseLabel(phase)}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-4 mt-8">
                {isComplete && (
                    <Link href={`/videos/${videoId}`} className="btn btn-primary">
                        Watch Video
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                )}
                {isFailed && (
                    <Link href="/create" className="btn btn-primary">
                        Try Again
                    </Link>
                )}
                <Link href="/videos" className="btn btn-secondary">
                    Back to Videos
                </Link>
            </div>
        </div>
    );
}
