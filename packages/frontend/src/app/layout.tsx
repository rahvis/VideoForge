import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
    title: 'Rebound - AI Video Creation Platform',
    description: 'Transform text prompts into professional-quality 60-120 second videos with AI-powered generation and synchronized narration.',
    keywords: ['AI video', 'video generation', 'Azure Sora', 'ElevenLabs', 'GPT-4o', 'text to video'],
    authors: [{ name: 'Rebound Team' }],
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-[var(--color-bg-primary)]">
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
