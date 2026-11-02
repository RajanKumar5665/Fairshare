import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let cachedConnection = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    cachedConnection = await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected');
    return cachedConnection;
  } catch (err) {
    cachedConnection = null;
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}

mongoose.connection.on('disconnected', () => {
  cachedConnection = null;
  logger.warn('MongoDB disconnected');
});
