import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

export async function connectDB() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    try {
        await mongoose.connect(env.MONGO_URI);
        logger.info('MongoDB connected');
    } catch (err) {
        logger.error({ err }, 'MongoDB connection failed');
        throw err;
    }
}

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});