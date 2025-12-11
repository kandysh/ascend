import { createDbClient } from '@ascend/db';
import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { apiKeysRoutes } from './routes/api-keys.js';
import { projectsRoutes } from './routes/projects.js';
import { tenantsRoutes } from './routes/tenants.js';
import { validateRoutes } from './routes/validate.js';
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
    dotenv: process.env.NODE_ENV === 'production',
  });

  await fastify.register(cors, {
    origin: true,
  });

  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Ascend Auth Service API',
        description: 'Authentication, tenant, and API key management',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development',
        },
      ],
      tags: [
        { name: 'tenants', description: 'Tenant management' },
        { name: 'projects', description: 'Project management' },
        { name: 'api-keys', description: 'API key management' },
        { name: 'validation', description: 'API key validation' },
      ],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
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
