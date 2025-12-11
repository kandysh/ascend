import Fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import { createRedisClient } from '@ascend/redis-client';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { usageMiddleware } from './middleware/usage.js';
import { proxyRoutes } from './routes/proxy.js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: resolve(__dirname, '../../../.env') });
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      REDIS_URL: string;
      AUTH_SERVICE_URL: string;
      SCORES_SERVICE_URL: string;
      LEADERBOARDS_SERVICE_URL: string;
      BILLING_SERVICE_URL: string;
    };
  }

  interface FastifyRequest {
    tenantId?: string;
    projectId?: string;
  }
}

const envSchema = {
  type: 'object',
  required: [
    'AUTH_SERVICE_URL',
    'SCORES_SERVICE_URL',
    'LEADERBOARDS_SERVICE_URL',
  ],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
    },
    AUTH_SERVICE_URL: {
      type: 'string',
    },
    SCORES_SERVICE_URL: {
      type: 'string',
    },
    LEADERBOARDS_SERVICE_URL: {
      type: 'string',
    },
    BILLING_SERVICE_URL: {
      type: 'string',
      default: 'http://localhost:3005',
    },
  },
};

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  await fastify.register(env, {
    schema: envSchema,
    dotenv: process.env.NODE_ENV === 'production',
  });

  await fastify.register(cors, {
    origin: true,
  });

  // Initialize Redis for rate limiting
  createRedisClient(fastify.config.REDIS_URL);

  fastify.get('/health', async () => {
    return { status: 'ok', service: 'gateway' };
  });

  // Register auth middleware (validates API key, sets planType)
  fastify.addHook('onRequest', authMiddleware);

  // Register Redis-based token bucket rate limiter
  fastify.addHook('onRequest', rateLimitMiddleware);

  // Register usage tracking middleware
  fastify.addHook('onResponse', usageMiddleware);

  // Register proxy routes
  await fastify.register(proxyRoutes);

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = server.config.PORT;

    await server.listen({ port, host: '0.0.0.0' });
    console.log(`API Gateway listening on port ${port}`);
  } catch (err) {
    console.error('Failed to start gateway:', err);
    process.exit(1);
  }
}

start();
