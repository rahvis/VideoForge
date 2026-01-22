import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';
import path from 'path';

async function fixVideoUrl() {
    try {
        await mongoose.connect(config.mongodbUri);

        const videoId = '6959a0a764d8f33dc602a951';
        const video = await Video.findById(videoId);

        if (video) {
            // Hardcode the fix for this specific video
            const baseUrl = `http://localhost:${config.port}`;

            // Fix file URLs
            if (video.files?.final_720p) {
                // Construct correct URL: http://localhost:3001/uploads/videos/{userId}/{videoId}/final_720p.mp4
                const relativePath = `videos/${video.userId}/${videoId}/final_720p.mp4`;
                video.files.final_720p.url = `${baseUrl}/uploads/${relativePath}`;
            }

            if (video.files?.final_480p) {
                const relativePath = `videos/${video.userId}/${videoId}/final_480p.mp4`;
                video.files.final_480p.url = `${baseUrl}/uploads/${relativePath}`;
            }

            if (video.files?.audio) {
                const relativePath = `videos/${video.userId}/${videoId}/audio.mp3`;
                video.files.audio.url = `${baseUrl}/uploads/${relativePath}`;
            }

            await video.save();
            console.log('✅ Fixed URLs for video:', videoId);
            console.log('New URL:', video.files?.final_720p?.url);
        } else {
            console.log('❌ Video not found');
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

fixVideoUrl();
