import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';

const VIDEO_ID = '695a3b75fa0ff9d92c2826b8';

async function checkStatus() {
    try {
        await mongoose.connect(config.mongodbUri);
        const video = await Video.findById(VIDEO_ID);

        if (video) {
            console.log('Video ID:', video._id);
            console.log('Status:', video.status);
            console.log('Progress:', video.progress, '%');
            console.log('Current Phase:', video.currentPhase);
            console.log('Error:', video.errorMessage || 'None');
            console.log('\nSegments:');
            for (const seg of video.segments || []) {
                console.log(`  Segment ${seg.segmentNumber}:`);
                console.log(`    status: ${seg.status}`);
                console.log(`    soraJobId: ${seg.soraJobId || 'undefined'}`);
                console.log(`    filePath: ${seg.filePath || 'undefined'}`);
                console.log(`    error: ${seg.error || 'None'}`);
            }
        } else {
            console.log('Video not found');
        }
    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkStatus();
