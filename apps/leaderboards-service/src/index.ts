import { createDbClient } from '@ascend/db';
import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { leaderboardsRoutes } from './routes/leaderboards.js';
import { seasonsRoutes } from './routes/seasons.js';
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
    projectId?: string;
  }
}

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'INTERNAL_API_SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 3003,
    },
    DATABASE_URL: {
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
        title: 'Ascend Leaderboards Service API',
        description: 'Leaderboard and season management (control plane)',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3003',
          description: 'Development',
        },
      ],
      tags: [
        { name: 'leaderboards', description: 'Leaderboard CRUD operations' },
        { name: 'seasons', description: 'Season management' },
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

  createDbClient(fastify.config.DATABASE_URL);

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
    return { status: 'ok', service: 'leaderboards-service' };
  });

  await fastify.register(leaderboardsRoutes, { prefix: '/leaderboards' });
  await fastify.register(seasonsRoutes, { prefix: '/seasons' });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = server.config.PORT;

    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Leaderboards service listening on port ${port}`);
  } catch (err) {
    console.error('Failed to start leaderboards service:', err);
    process.exit(1);
  }
}

start();
