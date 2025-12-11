import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';
import { verifyApiKey } from '@ascend/utils';

export const validateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
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
        await sql`
          UPDATE api_keys
          SET last_used_at = NOW()
          WHERE id = ${key.id}
        `;

        return {
          valid: true,
          tenantId: key.tenantId,
          projectId: key.projectId,
        };
      }
    }

    return {
      valid: false,
    };
  });
};
