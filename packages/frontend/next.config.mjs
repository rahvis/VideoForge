/** @type {import('next').NextConfig} */
const nextConfig = {
    // Image configuration
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3001',
            },
        ],
    },

    // Environment variables
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
        NEXT_PUBLIC_POLLING_INTERVAL: process.env.NEXT_PUBLIC_POLLING_INTERVAL || '10000',
        NEXT_PUBLIC_MAX_VIDEO_DURATION: process.env.NEXT_PUBLIC_MAX_VIDEO_DURATION || '120',
        NEXT_PUBLIC_MIN_VIDEO_DURATION: process.env.NEXT_PUBLIC_MIN_VIDEO_DURATION || '60',
    },

    // Transpile shared workspace package
    transpilePackages: ['@video-forge/shared'],
};

export default nextConfig;
