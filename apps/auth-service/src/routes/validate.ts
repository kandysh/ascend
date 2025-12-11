import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';
import { verifyApiKey } from '@ascend/utils';

export const validateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        description: 'Validate an API key and return tenant/project context',
        tags: ['validation'],
        body: {
          type: 'object',
          required: ['apiKey'],
          properties: {
            apiKey: { type: 'string', description: 'The API key to validate' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: {
                type: 'boolean',
                description: 'Whether the API key is valid',
              },
              tenantId: {
                type: 'string',
                format: 'uuid',
                description: 'Tenant ID (only if valid)',
              },
              projectId: {
                type: 'string',
                format: 'uuid',
                description: 'Project ID (only if valid)',
              },
              planType: {
                type: 'string',
                enum: ['free', 'pro', 'enterprise'],
                description: 'Tenant plan type (only if valid)',
              },
            },
            required: ['valid'],
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { apiKey } = request.body as { apiKey: string };

      if (!apiKey) {
        return reply.code(400).send({ error: 'API key is required' });
      }

      const sql = getDbClient();

      const allKeys = await sql`
      SELECT 
        ak.id,
        ak.key_hash as "keyHash",
        ak.project_id as "projectId",
        ak.revoked_at as "revokedAt",
        p.tenant_id as "tenantId"
      FROM api_keys ak
      INNER JOIN projects p ON ak.project_id = p.id
    `;

      for (const key of allKeys) {
        if (key.revokedAt) continue;

        const isValid = await verifyApiKey(apiKey, key.keyHash);

        if (isValid) {
          // Update last used timestamp
          await sql`
          UPDATE api_keys
          SET last_used_at = NOW()
          WHERE id = ${key.id}
        `;

          // Get tenant's plan type
          const [subscription] = await sql`
            SELECT plan_type
            FROM subscriptions
            WHERE tenant_id = ${key.tenantId}
              AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
          `;

          return {
            valid: true,
            tenantId: key.tenantId,
            projectId: key.projectId,
            planType: subscription?.plan_type || 'free',
          };
        }
      }

      return {
        valid: false,
      };
    },
  );
};
