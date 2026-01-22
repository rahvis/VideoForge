import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { ProcessingLock, LOCK_KEYS } from '../src/models/processing-lock.model.js';

async function clearLock() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(config.mongodbUri);
        console.log('✅ Connected to MongoDB');

        const key = LOCK_KEYS.VIDEO_PROCESSING;
        console.log(`🔓 Clearing lock: ${key}...`);

        const result = await ProcessingLock.releaseLock(key);

        if (result) {
            console.log('✅ Lock successfully released!');
        } else {
            console.log('ℹ️ Lock was not held or already released.');
        }

        // Also clear segment generation lock just in case
        await ProcessingLock.releaseLock(LOCK_KEYS.SEGMENT_GENERATION);
        console.log('✅ Segment generation lock cleared (if existed)');

    } catch (error) {
        console.error('❌ Error clearing lock:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

clearLock();
