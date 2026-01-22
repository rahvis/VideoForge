'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { VideoCard } from '@/components/VideoCard';
import { Loader2, Video, Plus } from 'lucide-react';
import Link from 'next/link';

// ==========================================
// My Videos Page
// ==========================================

interface Video {
    id: string;
    title: string;
    status: string;
    progress: number;
    targetDuration: number;
    thumbnail?: string;
    createdAt: string;
}

export default function VideosPage() {
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchVideos = async () => {
        try {
            const response = await api.getVideos(page, 12);
            if (response.success && response.data) {
                setVideos(response.data.videos);
                setTotalPages(response.data.pagination.totalPages);
            }
        } catch (error) {
            console.error('Failed to fetch videos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchVideos();
    }, [page]);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            await api.deleteVideo(id);
            setVideos(videos.filter((v) => v.id !== id));
        } catch (error) {
            console.error('Failed to delete video:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="px-6 py-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">
                        My Videos
                    </h1>
                    <p className="text-[var(--color-text-secondary)] mt-1">
                        {videos.length} video{videos.length !== 1 ? 's' : ''} created
                    </p>
                </div>

                <Link href="/create" className="btn btn-primary">
                    <Plus className="w-4 h-4" />
                    Create New
                </Link>
            </div>

            {/* Videos Grid */}
            {videos.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
                        <Video className="w-8 h-8 text-[var(--color-text-muted)]" />
                    </div>
                    <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-2">
                        No videos yet
                    </h3>
                    <p className="text-[var(--color-text-secondary)] mb-6">
                        Create your first AI-powered video
                    </p>
                    <Link href="/create" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Create Video
                    </Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((video) => (
                            <VideoCard
                                key={video.id}
                                id={video.id}
                                title={video.title}
                                status={video.status}
                                progress={video.progress}
                                targetDuration={video.targetDuration}
                                thumbnail={video.thumbnail}
                                createdAt={video.createdAt}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1}
                                className="btn btn-secondary"
                            >
                                Previous
                            </button>
                            <span className="text-[var(--color-text-muted)] px-4">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page === totalPages}
                                className="btn btn-secondary"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
