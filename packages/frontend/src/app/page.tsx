'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, ArrowRight, Clock, Layers, Video, Play } from 'lucide-react';

// ==========================================
// Landing / Home Page
// ==========================================

export default function LandingPage() {
    const { isAuthenticated, isLoading } = useAuth();

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)]">
            {/* Header */}
            <header className="border-b border-[var(--color-border)]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/logo.svg"
                            alt="Rebound Logo"
                            width={40}
                            height={40}
                            className="w-10 h-10"
                        />
                        <span className="text-xl font-semibold text-[var(--color-text-primary)]">
                            Rebound
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isLoading && !isAuthenticated ? (
                            <>
                                <Link href="/login" className="btn btn-secondary">
                                    Sign In
                                </Link>
                                <Link href="/login" className="btn btn-primary">
                                    Get Started
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </>
                        ) : !isLoading && isAuthenticated ? (
                            <Link href="/videos" className="btn btn-primary">
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        ) : null}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-6 py-20">
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)] text-sm font-medium mb-8">
                        <Sparkles className="w-4 h-4" />
                        AI-Powered Video Generation
                    </div>

                    <h1 className="text-6xl font-bold text-[var(--color-text-primary)] mb-6 tracking-tight">
                        Transform Ideas Into
                        <br />
                        <span className="gradient-text">Stunning Videos</span>
                    </h1>

                    <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10">
                        Create professional 60-120 second videos with AI-powered scene generation,
                        synchronized narration, and seamless transitions.
                    </p>

                    <div className="flex items-center justify-center gap-4">
                        <Link href="/login" className="btn btn-primary text-lg px-8 py-4">
                            <Play className="w-5 h-5" />
                            Start Creating
                        </Link>
                        <Link href="/login" className="btn btn-secondary text-lg px-8 py-4">
                            Sign In
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-accent-primary)]/10 flex items-center justify-center mb-5">
                            <Clock className="w-7 h-7 text-[var(--color-accent-primary)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            60-120 Seconds
                        </h3>
                        <p className="text-[var(--color-text-muted)]">
                            Extended video duration with multiple 12-second AI segments stitched seamlessly
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-success)]/10 flex items-center justify-center mb-5">
                            <Layers className="w-7 h-7 text-[var(--color-success)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            Scene Continuity
                        </h3>
                        <p className="text-[var(--color-text-muted)]">
                            Smooth crossfade transitions using intelligent frame extraction
                        </p>
                    </div>

                    <div className="card text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--color-info)]/10 flex items-center justify-center mb-5">
                            <Video className="w-7 h-7 text-[var(--color-info)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                            AI Narration
                        </h3>
                        <p className="text-[var(--color-text-muted)]">
                            ElevenLabs voice synthesis with long-form audio synchronized to video
                        </p>
                    </div>
                </div>

                {/* Powered By */}
                <div className="mt-20 text-center">
                    <p className="text-sm text-[var(--color-text-muted)] mb-4">Powered by</p>
                    <div className="flex items-center justify-center gap-8 text-[var(--color-text-secondary)]">
                        <span className="font-medium">Azure Sora</span>
                        <span>•</span>
                        <span className="font-medium">GPT-4o</span>
                        <span>•</span>
                        <span className="font-medium">ElevenLabs</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
