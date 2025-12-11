import { FastifyRequest, FastifyReply } from 'fastify';

interface ValidationResponse {
  valid: boolean;
  tenantId?: string;
  projectId?: string;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Skip auth for health check
  if (request.url === '/health') {
    return;
  }

  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'X-Api-Key header is required',
    });
  }

  try {
    // Validate API key with Auth Service
    const authServiceUrl = request.server.config.AUTH_SERVICE_URL;
    const response = await fetch(`${authServiceUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    const validation = (await response.json()) as ValidationResponse;

    if (!validation.valid) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
      });
    }

    // Inject tenant context into request
    request.tenantId = validation.tenantId;
    request.projectId = validation.projectId;

    // Add tenant context to headers for downstream services
    request.headers['x-tenant-id'] = validation.tenantId!;
    request.headers['x-project-id'] = validation.projectId!;

    request.log.info(
      {
        tenantId: validation.tenantId,
        projectId: validation.projectId,
        path: request.url,
      },
      'Request authenticated',
    );
  } catch (error) {
    request.log.error(error, 'Auth service error');
    return reply.code(503).send({
      error: 'Service Unavailable',
      message: 'Auth service is unavailable',
    });
  }
}
