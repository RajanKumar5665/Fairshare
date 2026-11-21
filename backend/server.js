import http from 'http';
import { Server } from 'socket.io';
import app, { corsOrigin } from './app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/database.js';
import { logger } from './src/config/logger.js';

const server = http.createServer(app);

export const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
});

io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
    });
});

async function start() {
    await connectDB();
    server.listen(env.PORT, () => {
        logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    });
}

start().catch((err) => {
    logger.fatal({ err }, 'Server startup failed');
    process.exit(1);
});

// PM2 restarts/deploys send SIGINT/SIGTERM: finish in-flight requests, then exit.
let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    io.close();
    server.close(async () => {
        try {
            const mongoose = (await import('mongoose')).default;
            await mongoose.connection.close();
        } finally {
            process.exit(0);
        }
    });
    setTimeout(() => process.exit(1), 10000).unref(); // force-quit if something hangs
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));