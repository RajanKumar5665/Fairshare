import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const message = statusCode >= 500 && env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (err.message || 'Internal server error');

    logger.error({ err, path: req.originalUrl }, err.message);

    res.status(statusCode).json({
        success: false,
        message,
        ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}