import { createDbClient } from '@ascend/db';
import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { usageRoutes } from './routes/usage.js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

if (process.env.NODE_ENV !== 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: resolve(__dirname, '../../../.env') });
}

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      DATABASE_URL: string;
      INTERNAL_API_SECRET: string;
    };
  }

  interface FastifyRequest {
    tenantId?: string;
  }
}

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'INTERNAL_API_SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 3005,
    },
    DATABASE_URL: {
      type: 'string',
    },
    INTERNAL_API_SECRET: {
      type: 'string',
    },
  },
};

async function start() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  await fastify.register(env, {
    schema: envSchema,
    dotenv: false,
  });

  await fastify.register(cors, {
    origin: true,
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Ascend Billing Service',
        description: 'Billing and usage tracking API',
        version: '1.0.0',
      },
      tags: [
        { name: 'subscriptions', description: 'Subscription management' },
        { name: 'usage', description: 'Usage tracking and reporting' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    staticCSP: true,
  });

  createDbClient(fastify.config.DATABASE_URL);

  fastify.addHook('preHandler', async (request, reply) => {
    const internalSecret = request.headers['x-internal-secret'];
    if (internalSecret !== fastify.config.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const tenantId = request.headers['x-tenant-id'] as string;
    if (tenantId) {
      request.tenantId = tenantId;
    }
  });

  await fastify.register(subscriptionsRoutes, { prefix: '/subscriptions' });
  await fastify.register(usageRoutes, { prefix: '/usage' });

  const port = fastify.config.PORT;
  await fastify.listen({ port, host: '0.0.0.0' });

  console.log(`✅ Billing service listening on port ${port}`);
  console.log(`📚 Docs available at http://localhost:${port}/docs`);
}

start().catch((err) => {
  console.error('Failed to start billing service:', err);
  process.exit(1);
});
