'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatDuration, formatDate } from '@/lib/utils';
import { Loader2, Download, Clock, Film, ChevronDown } from 'lucide-react';
import Link from 'next/link';

// ==========================================
// Video Player Page
// ==========================================

export default function VideoPlayerPage() {
    const params = useParams();
    const videoId = params.id as string;

    const [video, setVideo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [quality, setQuality] = useState<'720p' | '480p'>('720p');
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    useEffect(() => {
        if (!videoId) return;

        const fetchVideo = async () => {
            try {
                const response = await api.getVideo(videoId);
                if (response.success && response.data) {
                    setVideo(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch video:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchVideo();
    }, [videoId]);

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-primary)]" />
            </div>
        );
    }

    if (!video) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <p className="text-[var(--color-text-muted)]">Video not found</p>
            </div>
        );
    }

    // Use static file URL if available (preferred), otherwise fallback to API
    const fileKey = quality === '720p' ? 'final_720p' : 'final_480p';
    const staticUrl = video.files?.[fileKey]?.url;
    // Fallback to API URL (requires auth, so video tag might fail without cookies/token in URL)
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/files/${videoId}/video?quality=${quality}`;

    // Prioritize static URL for playback
    const videoUrl = staticUrl || apiUrl;
    const downloadUrl = videoUrl;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Video Player */}
            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden mb-8">
                {video.status === 'completed' ? (
                    <video
                        controls
                        className="w-full h-full"
                        poster={video.files?.thumbnail?.url}
                    >
                        <source src={videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <p className="text-white">Video is still processing...</p>
                    </div>
                )}
            </div>

            {/* Video Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                            {video.title}
                        </h1>
                        <p className="text-[var(--color-text-muted)]">
                            Created {formatDate(video.createdAt)}
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Clock className="w-4 h-4" />
                            <span>
                                {formatDuration(video.actualDuration || video.targetDuration)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Film className="w-4 h-4" />
                            <span>{video.segmentCount} segments</span>
                        </div>
                    </div>

                    {/* Scenes */}
                    {video.scenes && video.scenes.length > 0 && (
                        <div className="card">
                            <h3 className="font-medium text-[var(--color-text-primary)] mb-4">
                                Scene Breakdown
                            </h3>
                            <div className="space-y-3">
                                {video.scenes.slice(0, 5).map((scene: any, i: number) => (
                                    <div
                                        key={i}
                                        className="p-3 rounded-lg bg-[var(--color-bg-tertiary)]"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]">
                                                {i + 1}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-muted)]">
                                                0:{(i * 12).toString().padStart(2, '0')} - 0:
                                                {((i + 1) * 12).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                                            {scene.scenePrompt}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Download Card */}
                    <div className="card">
                        <h3 className="font-medium text-[var(--color-text-primary)] mb-4">
                            Download
                        </h3>

                        {/* Quality Selector */}
                        <div className="relative mb-4">
                            <button
                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                className="w-full btn btn-secondary justify-between"
                            >
                                <span>{quality}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showQualityMenu && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg overflow-hidden z-10">
                                    {['720p', '480p'].map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => {
                                                setQuality(q as '720p' | '480p');
                                                setShowQualityMenu(false);
                                            }}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <a
                            href={downloadUrl}
                            download
                            className="w-full btn btn-primary"
                        >
                            <Download className="w-4 h-4" />
                            Download Video
                        </a>
                    </div>

                    {/* Back */}
                    <Link href="/videos" className="block w-full btn btn-secondary text-center">
                        Back to Videos
                    </Link>
                </div>
            </div>
        </div>
    );
}
