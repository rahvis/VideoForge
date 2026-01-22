import app from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './database/index.js';
import { ensureUploadDirectories } from './utils/storage.js';

// ==========================================
// SERVER STARTUP
// ==========================================

async function startServer(): Promise<void> {
    try {
        console.log('🚀 Starting VideoForge Backend...\n');

        // Step 1: Connect to MongoDB
        console.log('📦 Connecting to MongoDB...');
        await connectDatabase();

        // Step 2: Ensure upload directories exist
        console.log('📁 Initializing upload directories...');
        await ensureUploadDirectories();

        // Step 3: Start Express server
        const server = app.listen(config.port, () => {
            console.log(`\n✅ VideoForge Backend is running!`);
            console.log(`📍 Environment: ${config.nodeEnv}`);
            console.log(`🌐 Server: http://localhost:${config.port}`);
            console.log(`📊 Health: http://localhost:${config.port}/health`);
            console.log(`🎬 Video Duration: ${config.duration.min}-${config.duration.max} seconds`);
            console.log(`🔢 Segment Duration: ${config.duration.segment} seconds\n`);
        });

        // Graceful shutdown handlers
        const shutdown = async (signal: string) => {
            console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);

            server.close(async () => {
                console.log('🔌 HTTP server closed');

                try {
                    const { disconnectDatabase } = await import('./database/index.js');
                    await disconnectDatabase();
                    console.log('✅ Graceful shutdown complete');
                    process.exit(0);
                } catch (error) {
                    console.error('❌ Error during shutdown:', error);
                    process.exit(1);
                }
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
