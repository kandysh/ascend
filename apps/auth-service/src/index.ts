import { createDbClient } from '@ascend/db';
import cors from '@fastify/cors';
import env from '@fastify/env';
import Fastify from 'fastify';
import { apiKeysRoutes } from './routes/api-keys.js';
import { projectsRoutes } from './routes/projects.js';
import { tenantsRoutes } from './routes/tenants.js';
import { validateRoutes } from './routes/validate.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      DATABASE_URL: string;
    };
  }
}

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    PORT: {
      type: 'number',
      default: 3001,
    },
    DATABASE_URL: {
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
    dotenv: true,
  });

  await fastify.register(cors, {
    origin: true,
  });

  createDbClient(fastify.config.DATABASE_URL);

  fastify.get('/health', async () => {
    return { status: 'ok', service: 'auth-service' };
  });

  await fastify.register(tenantsRoutes, { prefix: '/tenants' });
  await fastify.register(projectsRoutes, { prefix: '/projects' });
  await fastify.register(apiKeysRoutes, { prefix: '/api-keys' });
  await fastify.register(validateRoutes, { prefix: '/validate' });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = server.config.PORT;

    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Auth service listening on port ${port}`);
  } catch (err) {
    console.error('Failed to start auth service:', err);
    process.exit(1);
  }
}

start();
