import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';
import { ProcessingLock } from '../src/models/processing-lock.model.js';

async function resetVideo() {
    try {
        await mongoose.connect(config.mongodbUri);

        // Mark the specific failing video as failed
        await Video.findByIdAndUpdate('69599775b0c9a621523bd923', {
            status: 'failed',
            errorMessage: 'Reset by developer to test ffmpeg fix'
        });
        console.log('✅ Marked video 69599775b0c9a621523bd923 as failed');

        // Clear locks
        await ProcessingLock.deleteMany({});
        console.log('✅ Cleared all locks');

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetVideo();
