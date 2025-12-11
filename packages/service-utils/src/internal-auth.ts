import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Internal service authentication middleware
 * Validates X-Internal-Secret header and extracts tenant context
 */
export function createInternalAuthHook(internalSecret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health check
    if (request.url === '/health') {
      return;
    }

    const requestSecret = request.headers['x-internal-secret'];
    if (requestSecret !== internalSecret) {
      return reply
        .code(401)
        .send({ error: 'Unauthorized - Invalid internal secret' });
    }

    // Extract tenant context from headers
    const tenantId = request.headers['x-tenant-id'];
    const projectId = request.headers['x-project-id'];

    if (tenantId && typeof tenantId === 'string') {
      request.tenantId = tenantId;
    }
    if (projectId && typeof projectId === 'string') {
      request.projectId = projectId;
    }
  };
}

/**
 * Extend Fastify types for tenant context
 */
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    projectId?: string;
  }
}
