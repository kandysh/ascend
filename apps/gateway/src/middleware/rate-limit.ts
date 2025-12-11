import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';

interface TokenBucketConfig {
  capacity: number; // Maximum tokens in bucket
  refillRate: number; // Tokens added per second
  cost?: number; // Tokens consumed per request (default: 1)
}

// Plan-based rate limits (tokens per second)
const PLAN_RATE_LIMITS: Record<string, TokenBucketConfig> = {
  free: {
    capacity: 10, // Burst of 10 requests
    refillRate: 1, // 1 request per second = ~86K requests/day
  },
  pro: {
    capacity: 100, // Burst of 100 requests
    refillRate: 50, // 50 requests per second = ~4.3M requests/day
  },
  enterprise: {
    capacity: 500, // Burst of 500 requests
    refillRate: 200, // 200 requests per second = ~17M requests/day
  },
};

/**
 * Token Bucket Rate Limiter using Redis
 *
 * Algorithm:
 * 1. Calculate tokens to add based on time elapsed
 * 2. Add tokens up to capacity
 * 3. If enough tokens available, consume and allow request
 * 4. Otherwise, reject with 429
 *
 * Uses Redis for distributed rate limiting across gateway instances
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Skip rate limiting for health checks
  if (request.url === '/health') {
    return;
  }

  const tenantId = request.tenantId;
  if (!tenantId) {
    // No tenant ID means auth failed, let auth middleware handle it
    return;
  }

  // Get plan type from request context (set by auth middleware)
  const planType =
    (request as FastifyRequest & { planType?: string }).planType || 'free';
  const config = PLAN_RATE_LIMITS[planType] || PLAN_RATE_LIMITS.free;

  const redis = getRedisClient();
  const key = `rate_limit:${tenantId}`;
  const now = Date.now();
  const cost = config.cost || 1;

  try {
    // Use Redis Lua script for atomic token bucket operation
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local cost = tonumber(ARGV[3])
      local now = tonumber(ARGV[4])
      
      -- Get current bucket state
      local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add based on time elapsed
      local time_elapsed = (now - last_refill) / 1000 -- Convert to seconds
      local tokens_to_add = time_elapsed * refill_rate
      tokens = math.min(capacity, tokens + tokens_to_add)
      
      -- Check if we have enough tokens
      if tokens >= cost then
        tokens = tokens - cost
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 60) -- Keep for 1 minute after last request
        return {1, tokens, capacity} -- Allowed
      else
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 60)
        return {0, tokens, capacity} -- Denied
      end
    `;

    const result = (await redis.eval(
      luaScript,
      1,
      key,
      config.capacity,
      config.refillRate,
      cost,
      now,
    )) as [number, number, number];

    const [allowed, remainingTokens, capacity] = result;

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', capacity);
    reply.header('X-RateLimit-Remaining', Math.floor(remainingTokens));
    reply.header('X-RateLimit-Reset', Math.ceil(now / 1000) + 60);

    if (!allowed) {
      const retryAfter = Math.ceil(
        (cost - remainingTokens) / config.refillRate,
      );
      reply.header('Retry-After', retryAfter);
      return reply.code(429).send({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please retry after ${retryAfter} seconds.`,
        limit: capacity,
        remaining: Math.floor(remainingTokens),
        resetAt: new Date(now + retryAfter * 1000).toISOString(),
      });
    }
  } catch (error) {
    request.log.error(error, 'Rate limit check failed');
    // Fail open - allow request if Redis is down
    // In production, you might want to fail closed instead
  }
}
