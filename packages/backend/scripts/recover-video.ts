import { config } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { Video } from '../src/models/video.model.js';

const VIDEO_ID = '695a3b75fa0ff9d92c2826b8';
const USER_ID = '69597b468313a30a8c3df512';
const GENERATION_ID = 'gen_01ke48c0r4f89tgkxzhgtn78zk';
const JOB_ID = 'task_01ke483kkjedtbjfencj0z3b8a';

async function downloadAndSave() {
    try {
        // Download the video from Azure
        const contentUrl = `${config.azure.endpoint}openai/v1/video/generations/${GENERATION_ID}/content/video?api-version=${config.azure.apiVersion}`;
        console.log('📥 Downloading video from:', contentUrl);

        const response = await fetch(contentUrl, {
            headers: {
                'Api-key': config.azure.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Download failed:', response.status, errorText);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const videoBuffer = Buffer.from(arrayBuffer);
        console.log(`✅ Downloaded ${videoBuffer.length} bytes`);

        // Save to file
        const segmentPath = path.join(
            config.uploadDir,
            'videos',
            USER_ID,
            VIDEO_ID,
            'segments',
            'segment_001.mp4'
        );

        await fs.mkdir(path.dirname(segmentPath), { recursive: true });
        await fs.writeFile(segmentPath, videoBuffer);
        console.log(`💾 Saved to: ${segmentPath}`);

        // Update database
        await mongoose.connect(config.mongodbUri);
        console.log('📊 Updating database...');

        await Video.findOneAndUpdate(
            { _id: VIDEO_ID, 'segments.segmentNumber': 1 },
            {
                $set: {
                    'segments.$.status': 'completed',
                    'segments.$.filePath': segmentPath,
                    'segments.$.soraJobId': JOB_ID,
                    'segments.$.completedAt': new Date(),
                }
            }
        );

        // Check if we need to continue processing
        const video = await Video.findById(VIDEO_ID);
        console.log('Video segment count:', video?.segmentCount);
        console.log('All segments completed?', video?.segments?.every(s => s.status === 'completed'));

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

downloadAndSave();
