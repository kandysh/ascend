import { FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';

interface ValidationResponse {
  valid: boolean;
  tenantId?: string;
  projectId?: string;
  planType?: string;
}

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;

/**
 * Auth middleware with Redis-based API key caching
 *
 * Performance optimizations:
 * - Caches validated API keys in Redis for CACHE_TTL seconds
 * - Reduces auth-service load and request latency
 * - Falls back to auth-service on cache miss
 * - Cache invalidation happens automatically via TTL
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Skip auth for health check
  if (request.url === '/health') {
    return;
  }

  // Skip auth for /auth routes (tenant/project/api-key management)
  if (request.url.startsWith('/auth')) {
    return;
  }

  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'X-Api-Key header is required',
    });
  }

  try {
    const redis = getRedisClient();
    const cacheKey = `auth:${apiKey}`;

    // Try to get from cache first
    const cached = await redis.get(cacheKey);

    let validation: ValidationResponse;

    if (cached) {
      // Cache hit - parse and use cached validation
      validation = JSON.parse(cached);
      request.log.debug(
        { apiKey: apiKey.slice(0, 8) + '...' },
        'Auth cache hit',
      );
    } else {
      // Cache miss - validate with Auth Service
      request.log.debug(
        { apiKey: apiKey.slice(0, 8) + '...' },
        'Auth cache miss',
      );

      const authServiceUrl = request.server.config.AUTH_SERVICE_URL;
      const response = await fetch(`${authServiceUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      validation = (await response.json()) as ValidationResponse;

      if (!validation.valid) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or revoked API key',
        });
      }

      // Cache the valid result
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(validation));
    }

    // Inject tenant context into request
    request.tenantId = validation.tenantId;
    request.projectId = validation.projectId;

    // Store planType for rate limiting
    (request as FastifyRequest & { planType?: string }).planType =
      validation.planType || 'free';

    // Add tenant context to headers for downstream services
    request.headers['x-tenant-id'] = validation.tenantId!;
    request.headers['x-project-id'] = validation.projectId!;

    request.log.info(
      {
        tenantId: validation.tenantId,
        projectId: validation.projectId,
        planType: validation.planType,
        path: request.url,
      },
      'Request authenticated',
    );
  } catch (error) {
    request.log.error(error, 'Auth service error');
    return reply.code(503).send({
      error: 'Service Unavailable',
      message: 'Auth service is unavailable',
    });
  }
}

/**
 * Invalidate API key cache (call when key is revoked/updated)
 */
export async function invalidateAuthCache(apiKey: string) {
  const redis = getRedisClient();
  const cacheKey = `auth:${apiKey}`;
  await redis.del(cacheKey);
}
