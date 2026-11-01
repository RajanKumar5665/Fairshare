import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;

    logger.error({ err, path: req.originalUrl }, err.message);

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}