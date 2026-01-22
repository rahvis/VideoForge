import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { ProcessingLock } from '../src/models/index.js';

async function clearLocks() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to MongoDB');

        // Check current lock status
        const locks = await ProcessingLock.find({});
        console.log('Current locks:', JSON.stringify(locks, null, 2));

        // Delete all locks
        const result = await ProcessingLock.deleteMany({});
        console.log(`Deleted ${result.deletedCount} locks`);

        console.log('Done! You can now create a new video.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

clearLocks();
