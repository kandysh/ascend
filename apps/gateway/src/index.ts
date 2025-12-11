import Fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import rateLimit from '@fastify/rate-limit';
import { authMiddleware } from './middleware/auth.js';
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
  required: ['AUTH_SERVICE_URL'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    AUTH_SERVICE_URL: {
      type: 'string',
    },
    SCORES_SERVICE_URL: {
      type: 'string',
      default: 'http://localhost:3002',
    },
    LEADERBOARDS_SERVICE_URL: {
      type: 'string',
      default: 'http://localhost:3003',
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

  // Register rate limiter (used by proxy routes)
  await fastify.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.tenantId || 'anonymous',
  });

  fastify.get('/health', async () => {
    return { status: 'ok', service: 'gateway' };
  });

  // Register auth middleware (validates API key)
  fastify.addHook('onRequest', authMiddleware);

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
    console.log(`🚀 API Gateway listening on port ${port}`);
  } catch (err) {
    console.error('Failed to start gateway:', err);
    process.exit(1);
  }
}

start();
