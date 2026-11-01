import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/database.js';
import { logger } from './src/config/logger.js';

const server = http.createServer(app);

export const io = new Server(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
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

start();