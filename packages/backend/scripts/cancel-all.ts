import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Video } from '../src/models/video.model.js';

async function cancelAll() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        // Find all videos that are processing (not pending, completed, or failed)
        const processingVideos = await Video.find({
            status: { $nin: ['pending', 'completed', 'failed'] }
        });

        console.log(`Found ${processingVideos.length} videos still processing`);

        for (const video of processingVideos) {
            console.log(`Cancelling video ${video._id} (status: ${video.status})`);
            await Video.findByIdAndUpdate(video._id, {
                status: 'failed',
                errorMessage: 'Cancelled by user - previous processing stuck',
            });
        }

        // Also clear the lock collection
        const lockResult = await mongoose.connection.db.collection('locks').deleteMany({});
        console.log(`Cleared ${lockResult.deletedCount} locks`);

        console.log('Done! You can now create a new video.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

cancelAll();
