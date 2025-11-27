/**
 * @fileoverview Redis-based rate limiter middleware using sliding window algorithm
 * @module middleware/rateLimiter
 */

import { getClient, getRateLimitKey } from '../db/redis.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * @typedef {Object} RateLimitInfo
 * @property {number} limit - Maximum requests allowed per window
 * @property {number} remaining - Remaining requests in current window
 * @property {number} reset - Unix timestamp when the window resets
 */

/**
 * Get rate limit for a given plan
 * @param {string} plan - Tenant plan (free, hobby, pro, enterprise)
 * @returns {number} Rate limit (requests per second)
 */
function getRateLimitForPlan(plan) {
  return config.rateLimits[plan] || config.rateLimits.free;
}

/**
 * Sliding window rate limiter using Redis
 * @param {string} tenantId - Tenant ID
 * @param {string} plan - Tenant plan
 * @param {number} windowSizeMs - Window size in milliseconds
 * @returns {Promise<RateLimitInfo>} Rate limit information
 */
async function checkRateLimit(tenantId, plan, windowSizeMs = 1000) {
  const redis = getClient();
  const limit = getRateLimitForPlan(plan);
  const now = Date.now();
  const windowStart = now - windowSizeMs;
  const windowKey = getRateLimitKey(tenantId, 'sliding');

  // Use Redis transaction for atomic operations
  const pipeline = redis.pipeline();

  // Remove old entries outside the window
  pipeline.zremrangebyscore(windowKey, 0, windowStart);

  // Count current requests in window
  pipeline.zcard(windowKey);

  // Add current request with timestamp as score
  pipeline.zadd(windowKey, now, `${now}-${Math.random()}`);

  // Set expiry on the key
  pipeline.pexpire(windowKey, windowSizeMs * 2);

  const results = await pipeline.exec();

  // Get the count before adding current request
  const currentCount = results[1][1];
  const remaining = Math.max(0, limit - currentCount - 1);
  const reset = Math.ceil((now + windowSizeMs) / 1000);

  return {
    limit,
    remaining,
    reset,
    allowed: currentCount < limit,
  };
}

/**
 * Create rate limiter middleware
 * @param {Object} [options] - Rate limiter options
 * @param {number} [options.windowMs=1000] - Window size in milliseconds
 * @param {boolean} [options.skipFailedRequests=false] - Skip counting failed requests
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @returns {import('express').RequestHandler} Express middleware
 */
export function createRateLimiter(options = {}) {
  const { windowMs = 1000, skipFailedRequests = false } = options;

  /**
   * Rate limiter middleware
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return async function rateLimiter(req, res, next) {
    // Skip rate limiting if no tenant context (will be handled by auth middleware)
    if (!req.tenant) {
      return next();
    }

    const { tenantId, plan } = req.tenant;

    try {
      const rateLimitInfo = await checkRateLimit(tenantId, plan, windowMs);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit);
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset);

      if (!rateLimitInfo.allowed) {
        logger.warn(
          {
            tenantId,
            plan,
            limit: rateLimitInfo.limit,
            path: req.path,
          },
          'Rate limit exceeded'
        );

        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${rateLimitInfo.limit} requests per second allowed for ${plan} plan.`,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Track if request fails for skipFailedRequests option
      if (skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function (...args) {
          if (res.statusCode >= 400) {
            // Decrement counter for failed requests
            const redis = getClient();
            const windowKey = getRateLimitKey(tenantId, 'sliding');
            redis.zpopmax(windowKey).catch(() => {
              // Ignore errors in cleanup
            });
          }
          return originalEnd.apply(res, args);
        };
      }

      next();
    } catch (err) {
      // If Redis is down, allow the request but log the error
      logger.error({ err, tenantId }, 'Rate limiter error, allowing request');
      next();
    }
  };
}

/**
 * Check if tenant has exceeded monthly operation limit
 * @param {string} tenantId - Tenant ID
 * @param {string} plan - Tenant plan
 * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
 */
export async function checkUsageLimit(tenantId, plan) {
  const redis = getClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${tenantId}:${month}`;

  const limit = config.plans[plan] || config.plans.free;
  const used = parseInt((await redis.get(usageKey)) || '0', 10);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Increment usage counter for tenant
 * @param {string} tenantId - Tenant ID
 * @param {number} [count=1] - Number of operations to add
 * @returns {Promise<number>} New usage count
 */
export async function incrementUsage(tenantId, count = 1) {
  const redis = getClient();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usageKey = `usage:${tenantId}:${month}`;

  const pipeline = redis.pipeline();
  pipeline.incrby(usageKey, count);
  // Set expiry to end of next month (to be safe)
  pipeline.expire(usageKey, 60 * 60 * 24 * 62);

  const results = await pipeline.exec();
  return results[0][1];
}

/**
 * Usage limit middleware - checks monthly operation limits
 * @returns {import('express').RequestHandler} Express middleware
 */
export function usageLimitMiddleware() {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return async function usageLimit(req, res, next) {
    if (!req.tenant) {
      return next();
    }

    const { tenantId, plan } = req.tenant;

    try {
      const usage = await checkUsageLimit(tenantId, plan);

      // Set usage headers
      res.setHeader('X-Usage-Limit', usage.limit);
      res.setHeader('X-Usage-Remaining', usage.remaining);

      if (!usage.allowed) {
        logger.warn(
          {
            tenantId,
            plan,
            used: usage.used,
            limit: usage.limit,
          },
          'Monthly usage limit exceeded'
        );

        return res.status(429).json({
          error: 'Usage Limit Exceeded',
          message: `Monthly operation limit of ${usage.limit} exceeded for ${plan} plan. Please upgrade your plan.`,
          used: usage.used,
          limit: usage.limit,
        });
      }

      next();
    } catch (err) {
      logger.error({ err, tenantId }, 'Usage limit check error, allowing request');
      next();
    }
  };
}

export default {
  createRateLimiter,
  checkRateLimit,
  checkUsageLimit,
  incrementUsage,
  usageLimitMiddleware,
};
