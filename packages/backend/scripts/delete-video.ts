import mongoose from 'mongoose';
import { config } from '../src/config/index.js';

const VIDEO_ID = '69598390cad74cc3a5d8cf3d';

async function deleteVideo() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        const result = await mongoose.connection.db.collection('videos').deleteOne({
            _id: new mongoose.Types.ObjectId(VIDEO_ID)
        });

        if (result.deletedCount === 1) {
            console.log(`Successfully deleted video ${VIDEO_ID}`);
        } else {
            console.log(`Video ${VIDEO_ID} not found`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

deleteVideo();
