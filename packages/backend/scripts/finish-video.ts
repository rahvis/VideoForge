import mongoose from 'mongoose';
import path from 'path';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';
import { videoStitchingService } from '../src/services/video-stitching.service.js';
import { audioService } from '../src/services/audio.service.js';
import { frameExtractionService } from '../src/services/frame-extraction.service.js';
import { storageService } from '../src/services/storage.service.js';
import { promptService } from '../src/services/prompt.service.js';

const VIDEO_ID = '695a3b75fa0ff9d92c2826b8';
const USER_ID = '69597b468313a30a8c3df512';

async function finishVideo() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        const video = await Video.findById(VIDEO_ID);
        if (!video) {
            console.error('Video not found');
            return;
        }

        console.log('Video:', video.title);
        console.log('Segment Count:', video.segmentCount);

        const paths = storageService.getVideoPaths(USER_ID, VIDEO_ID);
        console.log('Paths:', paths);

        // Phase 3: Stitching
        console.log('\n🔗 Phase 3: Stitching...');
        const segmentPaths = await storageService.getExistingSegmentPaths(USER_ID, VIDEO_ID);
        console.log('Segment paths:', segmentPaths);

        if (segmentPaths.length === 0) {
            console.error('No segments found!');
            return;
        }

        await videoStitchingService.stitchWithCrossfade(segmentPaths, paths.stitched720p);
        console.log('✅ Stitched');

        // Phase 4: Audio
        console.log('\n🎙️ Phase 4: Audio...');
        const scenes = video.scenes || [{ sceneNumber: 1, scenePrompt: video.enhancedPrompt || video.originalPrompt }];
        const script = await promptService.generateNarrationScript(
            video.enhancedPrompt || video.originalPrompt,
            scenes,
            video.targetDuration
        );
        await audioService.generateNarration(script, paths.audio);
        console.log('✅ Audio generated');

        // Phase 5: Merge
        console.log('\n🎵 Phase 5: Merging...');
        await videoStitchingService.mergeAudioVideo(paths.stitched720p, paths.audio, paths.final720p);
        console.log('✅ Merged');

        // Generate thumbnail
        console.log('\n📸 Generating thumbnail...');
        await frameExtractionService.generateThumbnail(paths.final720p, paths.thumbnail);
        console.log('✅ Thumbnail');

        // Phase 6: Transcode 480p
        console.log('\n📐 Phase 6: Transcoding 480p...');
        await videoStitchingService.transcodeResolution(paths.final720p, paths.final480p, 854, 480);
        console.log('✅ Transcoded');

        // Update database
        console.log('\n📊 Updating database...');
        const metadata = await frameExtractionService.getVideoMetadata(paths.final720p);

        await Video.findByIdAndUpdate(VIDEO_ID, {
            status: 'completed',
            progress: 100,
            currentPhase: 'Video processing complete',
            actualDuration: metadata.duration,
            completedAt: new Date(),
            'files.stitched_720p': {
                path: paths.stitched720p,
                url: storageService.getPublicUrl(paths.stitched720p),
                size: await storageService.getFileSize(paths.stitched720p),
                format: 'mp4',
            },
            'files.final_720p': {
                path: paths.final720p,
                url: storageService.getPublicUrl(paths.final720p),
                size: await storageService.getFileSize(paths.final720p),
                format: 'mp4',
                duration: metadata.duration,
            },
            'files.final_480p': {
                path: paths.final480p,
                url: storageService.getPublicUrl(paths.final480p),
                size: await storageService.getFileSize(paths.final480p),
                format: 'mp4',
            },
            'files.audio': {
                path: paths.audio,
                url: storageService.getPublicUrl(paths.audio),
                size: await storageService.getFileSize(paths.audio),
                format: 'mp3',
            },
            'files.thumbnail': {
                path: paths.thumbnail,
                url: storageService.getPublicUrl(paths.thumbnail),
                size: await storageService.getFileSize(paths.thumbnail),
                format: 'jpg',
            },
        });

        console.log('\n✅✅✅ Video processing complete!');
    } catch (error: any) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

finishVideo();
