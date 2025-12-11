import { FastifyRequest, FastifyReply } from 'fastify';

// In-memory usage tracking (in production, use Redis or a queue)
const usageStats = new Map<string, number>();

export async function usageMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Skip for health check
  if (request.url === '/health') {
    return;
  }

  // Only track successful requests
  if (reply.statusCode < 400 && request.tenantId) {
    const key = `${request.tenantId}:${new Date().toISOString().split('T')[0]}`;
    const current = usageStats.get(key) || 0;
    usageStats.set(key, current + 1);

    request.log.info(
      {
        tenantId: request.tenantId,
        projectId: request.projectId,
        path: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        dailyUsage: current + 1,
      },
      'Request tracked',
    );
  }
}

// Export for monitoring/billing
export function getUsageStats() {
  return Object.fromEntries(usageStats);
}

export function resetUsageStats() {
  usageStats.clear();
}
