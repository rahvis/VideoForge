import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';
import { processingService } from '../src/services/processing.service.js';
import { lockService } from '../src/services/lock.service.js';

const VIDEO_ID = '695a3b75fa0ff9d92c2826b8';

async function continueProcessing() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        // Clear any existing locks
        await lockService.forceReleaseLock();
        console.log('Cleared locks');

        // Update video status to continue from stitching phase
        await Video.findByIdAndUpdate(VIDEO_ID, {
            status: 'stitching',
            progress: 70,
            currentPhase: 'Resuming video processing',
        });

        console.log('Status updated - now triggering processing...\n');

        // Resume processing
        await processingService.processVideo(VIDEO_ID);

        console.log('\n✅ Processing complete!');
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

continueProcessing();
