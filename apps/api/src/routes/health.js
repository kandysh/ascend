/**
 * @fileoverview Health check routes for service monitoring
 * @module routes/health
 */

import { Router } from 'express';
import redis from '../db/redis.js';
import db from '../db/postgres.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * @route GET /health
 * @description Basic health check endpoint
 * @access Public
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * @route GET /health/ready
 * @description Readiness probe - checks if all dependencies are ready
 * @access Public
 */
router.get('/ready', async (req, res) => {
  const checks = {
    redis: false,
    postgres: false,
  };

  try {
    // Check Redis
    const redisHealth = await redis.healthCheck();
    checks.redis = redisHealth.status === 'healthy';

    // Check PostgreSQL
    checks.postgres = await db.healthCheck();

    const allHealthy = Object.values(checks).every(Boolean);

    if (allHealthy) {
      res.json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({
      status: 'error',
      checks,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /health/live
 * @description Liveness probe - checks if the service is alive
 * @access Public
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
});

/**
 * @route GET /health/detailed
 * @description Detailed health check with latency metrics
 * @access Public
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const details = {
    service: 'ascend-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {},
    latencies: {},
  };

  try {
    // Redis health check with latency
    const redisStart = Date.now();
    const redisHealth = await redis.healthCheck();
    details.checks.redis = {
      status: redisHealth.status,
      latency: redisHealth.latency,
    };
    details.latencies.redis = Date.now() - redisStart;

    // PostgreSQL health check with latency
    const pgStart = Date.now();
    const pgHealthy = await db.healthCheck();
    details.checks.postgres = {
      status: pgHealthy ? 'healthy' : 'unhealthy',
    };
    details.latencies.postgres = Date.now() - pgStart;

    // Memory usage
    const memUsage = process.memoryUsage();
    details.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
    };

    // CPU usage
    const cpuUsage = process.cpuUsage();
    details.cpu = {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
    };

    // Overall status
    const allHealthy =
      details.checks.redis.status === 'healthy' &&
      details.checks.postgres.status === 'healthy';

    details.status = allHealthy ? 'healthy' : 'degraded';
    details.totalLatency = Date.now() - startTime;

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(details);
  } catch (err) {
    logger.error({ err }, 'Detailed health check failed');
    details.status = 'error';
    details.error = err.message;
    details.totalLatency = Date.now() - startTime;
    res.status(503).json(details);
  }
});

export default router;
