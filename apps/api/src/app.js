/**
 * @fileoverview Main Express application with middleware configuration
 * @module app
 */

import express from 'express';
import pinoHttp from 'pino-http';
import { nanoid } from 'nanoid';

import config from './config/index.js';
import logger from './utils/logger.js';
import { authenticate } from './middleware/auth.js';
import { createRateLimiter, usageLimitMiddleware } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import v1Router from './routes/v1/index.js';

/**
 * Create and configure the Express application
 * @returns {import('express').Application} Configured Express app
 */
export function createApp() {
  const app = express();

  // Trust proxy for correct IP detection behind load balancers
  if (config.trustProxy) {
    app.set('trust proxy', true);
  }

  // Disable x-powered-by header for security
  app.disable('x-powered-by');

  // Request ID middleware - adds unique ID to each request
  app.use((req, res, next) => {
    req.id = req.get('x-request-id') || nanoid();
    res.setHeader('x-request-id', req.id);
    next();
  });

  // Pino HTTP logger middleware
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },
      customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
      },
      customReceivedMessage: (req) => {
        return `${req.method} ${req.url}`;
      },
      redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    })
  );

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Api-Key, X-Request-ID'
    );
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  // Health check routes (no auth required)
  app.use('/health', healthRouter);

  // API version 1 routes (with auth)
  app.use(
    '/v1',
    authenticate,
    createRateLimiter({ windowMs: 1000 }),
    usageLimitMiddleware(),
    v1Router
  );

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Ascend Leaderboard API',
      version: '1.0.0',
      documentation: '/docs',
      health: '/health',
      api: '/v1',
    });
  });

  // 404 handler for unknown routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

export default createApp;
