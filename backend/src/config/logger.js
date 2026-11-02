import pino from 'pino';
import { env } from './env.js';

const isServerless = process.env.VERCEL === '1' || env.NODE_ENV === 'production';

export const logger = pino({
    level: isServerless ? 'info' : 'debug',
    ...(isServerless
        ? {}
        : {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
            },
        }),
});