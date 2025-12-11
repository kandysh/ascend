import { createRedisClient } from '@ascend/redis-client';
import { createNatsClient } from '@ascend/nats-client';
import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { scoresRoutes } from './routes/scores.js';
import { leaderboardsRoutes } from './routes/leaderboards.js';
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
      REDIS_URL: string;
      NATS_URL: string;
      INTERNAL_API_SECRET: string;
    };
  }

  interface FastifyRequest {
    tenantId?: string;
    projectId?: string;
  }
}

const envSchema = {
  type: 'object',
  required: ['REDIS_URL', 'NATS_URL', 'INTERNAL_API_SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 3002,
    },
    REDIS_URL: {
      type: 'string',
    },
    NATS_URL: {
      type: 'string',
    },
    INTERNAL_API_SECRET: {
      type: 'string',
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

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Ascend Scores Service API',
        description: 'Real-time score updates and leaderboard queries',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3002',
          description: 'Development',
        },
      ],
      tags: [
        { name: 'scores', description: 'Score management' },
        { name: 'leaderboards', description: 'Leaderboard queries' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });

  createRedisClient(fastify.config.REDIS_URL);
  await createNatsClient(fastify.config.NATS_URL);

  fastify.addHook('preHandler', async (request, reply) => {
    const internalSecret = request.headers['x-internal-secret'];
    if (internalSecret !== fastify.config.INTERNAL_API_SECRET) {
      reply.code(401).send({ error: 'Unauthorized - Invalid internal secret' });
      return;
    }

    const tenantId = request.headers['x-tenant-id'];
    const projectId = request.headers['x-project-id'];

    if (tenantId && typeof tenantId === 'string') {
      request.tenantId = tenantId;
    }
    if (projectId && typeof projectId === 'string') {
      request.projectId = projectId;
    }
  });

  fastify.get('/health', async () => {
    return { status: 'ok', service: 'scores-service' };
  });

  await fastify.register(scoresRoutes, { prefix: '/scores' });
  await fastify.register(leaderboardsRoutes, { prefix: '/leaderboards' });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = server.config.PORT;

    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Scores service listening on port ${port}`);
  } catch (err) {
    console.error('Failed to start scores service:', err);
    process.exit(1);
  }
}

start();
