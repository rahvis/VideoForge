import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';

const VIDEO_ID = '695a2e1855c7f565131d290f';

async function resetVideo() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        // Reset the video to failed status
        const result = await Video.findByIdAndUpdate(VIDEO_ID, {
            status: 'failed',
            errorMessage: 'Reset for debugging - previous attempt stuck',
        });

        if (result) {
            console.log(`Reset video ${VIDEO_ID} to failed status`);
        } else {
            console.log('Video not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
}

resetVideo();
