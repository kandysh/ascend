import { FastifyPluginAsync } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';

export const proxyRoutes: FastifyPluginAsync = async (fastify) => {
  // Register rate limiter
  await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.tenantId || 'anonymous',
  });

  // Scores Service routes
  await fastify.register(httpProxy, {
    upstream: fastify.config.SCORES_SERVICE_URL,
    prefix: '/scores',
    rewritePrefix: '/scores',
    http2: false,
  });

  // Leaderboards Service routes
  await fastify.register(httpProxy, {
    upstream: fastify.config.LEADERBOARDS_SERVICE_URL,
    prefix: '/leaderboards',
    rewritePrefix: '/leaderboards',
    http2: false,
  });

  // Billing Service routes
  await fastify.register(httpProxy, {
    upstream: fastify.config.BILLING_SERVICE_URL,
    prefix: '/billing',
    rewritePrefix: '/billing',
    http2: false,
  });
};
