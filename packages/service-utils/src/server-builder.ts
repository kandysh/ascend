import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ServiceConfig } from './types.js';
import { createEnvSchema, loadEnvFile } from './env-loader.js';
import { createInternalAuthHook } from './internal-auth.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    config: Record<string, unknown>;
  }
}

/**
 * Creates a standardized Fastify server with common plugins
 */
export async function createService(
  config: ServiceConfig,
): Promise<FastifyInstance> {
  // Load environment variables
  loadEnvFile();

  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register environment validation
  await fastify.register(env, {
    schema: config.envSchema || createEnvSchema(config.name, config.port),
    dotenv: process.env.NODE_ENV === 'production',
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
  });

  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: config.title,
        description: config.description,
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development',
        },
      ],
      tags: config.tags || [],
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

  // Run custom initialization (e.g., DB/Redis/NATS setup)
  if (config.onInit) {
    await config.onInit(fastify.config);
  }

  // Register internal authentication if required
  if (config.requiresInternalAuth) {
    const internalSecret = fastify.config.INTERNAL_API_SECRET as string;
    if (!internalSecret) {
      throw new Error('INTERNAL_API_SECRET is required for internal services');
    }
    fastify.addHook('preHandler', createInternalAuthHook(internalSecret));
  }

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', service: config.name };
  });

  // Register routes
  for (const route of config.routes) {
    await fastify.register(route.plugin, { prefix: route.prefix });
  }

  return fastify;
}

/**
 * Starts a Fastify service
 */
export async function startService(
  config: ServiceConfig,
): Promise<FastifyInstance> {
  try {
    const server = await createService(config);
    const port = (server.config.PORT as number) || config.port;

    await server.listen({ port, host: '0.0.0.0' });
    console.log(`${config.title} listening on port ${port}`);
    console.log(`Docs available at http://localhost:${port}/docs`);

    return server;
  } catch (err) {
    console.error(`Failed to start ${config.name}:`, err);
    process.exit(1);
  }
}
