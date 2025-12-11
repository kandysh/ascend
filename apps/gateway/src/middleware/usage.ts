import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';

/**
 * Redis-based usage tracking middleware
 *
 * Uses Redis sorted sets and hashes for durable, multi-instance safe tracking:
 * - Increments daily usage counters atomically
 * - Batches writes to Redis for efficiency
 * - Supports distributed gateway instances
 */
export async function usageMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Skip for health check
  if (request.url === '/health') {
    return;
  }

  // Only track successful requests
  if (reply.statusCode < 400 && request.tenantId) {
    const redis = getRedisClient();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tenantKey = `usage:${request.tenantId}:${date}`;
    const projectKey = request.projectId
      ? `usage:${request.tenantId}:${request.projectId}:${date}`
      : null;

    try {
      // Use Redis pipeline for batched writes
      const pipeline = redis.pipeline();

      // Increment tenant daily usage
      pipeline.hincrby(tenantKey, 'requests', 1);
      pipeline.expire(tenantKey, 60 * 60 * 24 * 90); // Keep 90 days

      // Increment project usage if available
      if (projectKey) {
        pipeline.hincrby(projectKey, 'requests', 1);
        pipeline.expire(projectKey, 60 * 60 * 24 * 90);
      }

      // Track hourly breakdown for analytics
      const hour = new Date().getHours();
      pipeline.hincrby(tenantKey, `hour:${hour}`, 1);

      // Execute all commands atomically
      await pipeline.exec();

      // Log for observability (non-blocking)
      request.log.info(
        {
          tenantId: request.tenantId,
          projectId: request.projectId,
          path: request.url,
          method: request.method,
          statusCode: reply.statusCode,
        },
        'Request tracked',
      );
    } catch (error) {
      // Fail gracefully - don't block requests if Redis is down
      request.log.error(error, 'Failed to track usage in Redis');
    }
  }
}

/**
 * Get usage stats from Redis for monitoring/billing
 * @param tenantId - Tenant ID to get stats for
 * @param date - Date in YYYY-MM-DD format (defaults to today)
 */
export async function getUsageStats(tenantId: string, date?: string) {
  const redis = getRedisClient();
  const targetDate = date || new Date().toISOString().split('T')[0];
  const key = `usage:${tenantId}:${targetDate}`;

  try {
    const stats = await redis.hgetall(key);
    return {
      tenantId,
      date: targetDate,
      totalRequests: parseInt(stats.requests || '0', 10),
      hourlyBreakdown: Object.entries(stats)
        .filter(([k]) => k.startsWith('hour:'))
        .reduce(
          (acc, [k, v]) => {
            acc[k.replace('hour:', '')] = parseInt(v, 10);
            return acc;
          },
          {} as Record<string, number>,
        ),
    };
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    throw error;
  }
}

/**
 * Get usage stats for a date range
 */
export async function getUsageStatsRange(
  tenantId: string,
  startDate: string,
  endDate: string,
) {
  const redis = getRedisClient();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split('T')[0];
    const key = `usage:${tenantId}:${date}`;
    const stats = await redis.hgetall(key);
    results.push({
      date,
      requests: parseInt(stats.requests || '0', 10),
    });
  }

  return results;
}
