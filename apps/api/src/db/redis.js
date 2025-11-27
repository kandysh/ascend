/**
 * @fileoverview Redis client with connection management and health check
 * @module db/redis
 */

import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * @typedef {Object} RedisClient
 * @property {Redis} client - IORedis client instance
 * @property {Function} connect - Connect to Redis
 * @property {Function} disconnect - Disconnect from Redis
 * @property {Function} healthCheck - Check Redis connection health
 * @property {Function} getClient - Get the Redis client instance
 */

/** @type {Redis | null} */
let redisClient = null;

/**
 * Create and configure Redis client
 * @returns {Redis} Configured Redis client
 */
function createClient() {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn({ attempt: times, delay }, 'Redis connection retry');
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Only reconnect when the error contains "READONLY"
        return true;
      }
      return false;
    },
    enableReadyCheck: true,
    lazyConnect: true,
  });

  // Event handlers
  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting...');
  });

  return client;
}

/**
 * Connect to Redis
 * @returns {Promise<Redis>} Connected Redis client
 */
export async function connect() {
  if (!redisClient) {
    redisClient = createClient();
  }

  if (redisClient.status === 'ready') {
    return redisClient;
  }

  await redisClient.connect();
  logger.info('Redis connected successfully');
  return redisClient;
}

/**
 * Disconnect from Redis
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

/**
 * Check Redis connection health
 * @returns {Promise<{status: string, latency: number}>}
 */
export async function healthCheck() {
  if (!redisClient || redisClient.status !== 'ready') {
    return { status: 'disconnected', latency: -1 };
  }

  const start = Date.now();
  try {
    await redisClient.ping();
    const latency = Date.now() - start;
    return { status: 'healthy', latency };
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return { status: 'unhealthy', latency: -1 };
  }
}

/**
 * Get the Redis client instance
 * @returns {Redis} Redis client
 * @throws {Error} If Redis client is not initialized
 */
export function getClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connect() first.');
  }
  return redisClient;
}

/**
 * Generate Redis key for leaderboard
 * @param {string} tenantId - Tenant ID
 * @param {string} projectId - Project ID
 * @param {string} leaderboardId - Leaderboard ID
 * @returns {string} Redis key
 */
export function getLeaderboardKey(tenantId, projectId, leaderboardId) {
  return `l:${tenantId}:${projectId}:${leaderboardId}`;
}

/**
 * Generate Redis key for rate limiting
 * @param {string} tenantId - Tenant ID
 * @param {string} window - Time window identifier
 * @returns {string} Redis key
 */
export function getRateLimitKey(tenantId, window) {
  return `rl:${tenantId}:${window}`;
}

/**
 * Generate Redis key for usage tracking
 * @param {string} tenantId - Tenant ID
 * @param {string} month - Month identifier (YYYY-MM)
 * @returns {string} Redis key
 */
export function getUsageKey(tenantId, month) {
  return `usage:${tenantId}:${month}`;
}

export default {
  connect,
  disconnect,
  healthCheck,
  getClient,
  getLeaderboardKey,
  getRateLimitKey,
  getUsageKey,
};
