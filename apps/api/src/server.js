/**
 * @fileoverview Server entry point with graceful shutdown
 * @module server
 */

// Initialize OpenTelemetry BEFORE any other imports
import { initOtel } from './utils/otel.js';

// Only initialize OTEL in non-development environments or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.OTEL_ENABLED === 'true') {
  initOtel();
}

import { createApp } from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import redis from './db/redis.js';
import db from './db/postgres.js';

/**
 * Server instance reference for graceful shutdown
 * @type {import('http').Server | null}
 */
let server = null;

/**
 * Flag to prevent multiple shutdown attempts
 * @type {boolean}
 */
let isShuttingDown = false;

/**
 * Start the server
 * @returns {Promise<import('http').Server>}
 */
async function start() {
  try {
    logger.info('Starting Ascend API server...');

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await redis.connect();

    // Verify PostgreSQL connection
    logger.info('Verifying PostgreSQL connection...');
    const pgHealthy = await db.healthCheck();
    if (!pgHealthy) {
      throw new Error('PostgreSQL health check failed');
    }
    logger.info('PostgreSQL connection verified');

    // Create Express app
    const app = createApp();

    // Start HTTP server
    server = app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          env: config.nodeEnv,
          pid: process.pid,
        },
        `🚀 Ascend API server listening on port ${config.port}`
      );
    });

    // Configure server timeouts
    server.keepAliveTimeout = 65000; // Slightly higher than ALB's 60s default
    server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout

    // Handle server errors
    server.on('error', (err) => {
      logger.fatal({ err }, 'Server error');
      process.exit(1);
    });

    return server;
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

/**
 * Gracefully shutdown the server
 * @param {string} signal - Signal that triggered shutdown
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown...');

  // Set a timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new connections
    if (server) {
      logger.info('Closing HTTP server...');
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      logger.info('HTTP server closed');
    }

    // Close Redis connection
    logger.info('Closing Redis connection...');
    await redis.disconnect();
    logger.info('Redis connection closed');

    // Close PostgreSQL connection pool
    logger.info('Closing PostgreSQL connection pool...');
    await db.close();
    logger.info('PostgreSQL connection pool closed');

    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
}

// Register signal handlers for graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  shutdown('uncaughtException').catch(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection');
  shutdown('unhandledRejection').catch(() => {
    process.exit(1);
  });
});

// Start the server
start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
