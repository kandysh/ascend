import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';
import { generateApiKey, hashApiKey } from '@ascend/utils';

export const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
    const { projectId, name } = request.body as {
      projectId: string;
      name: string;
    };

    if (!projectId || !name) {
      return reply.code(400).send({ error: 'ProjectId and name are required' });
    }

    const sql = getDbClient();

    const [project] = await sql`
      SELECT * FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    const [created] = await sql`
      INSERT INTO api_keys (project_id, name, key_hash)
      VALUES (${projectId}, ${name}, ${keyHash})
      RETURNING *
    `;

    return {
      apiKey,
      id: created.id,
      name: created.name,
      projectId: created.project_id,
      createdAt: created.created_at,
    };
  });

  fastify.post('/:id/rotate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const sql = getDbClient();

    const [existing] = await sql`
      SELECT * FROM api_keys
      WHERE id = ${id} AND revoked_at IS NULL
      LIMIT 1
    `;

    if (!existing) {
      return reply
        .code(404)
        .send({ error: 'API key not found or already revoked' });
    }

    const newApiKey = generateApiKey();
    const newKeyHash = await hashApiKey(newApiKey);

    await sql`
      UPDATE api_keys
      SET revoked_at = NOW()
      WHERE id = ${id}
    `;

    const [rotated] = await sql`
      INSERT INTO api_keys (project_id, name, key_hash)
      VALUES (${existing.project_id}, ${existing.name}, ${newKeyHash})
      RETURNING *
    `;

    return {
      apiKey: newApiKey,
      id: rotated.id,
      name: rotated.name,
      projectId: rotated.project_id,
      createdAt: rotated.created_at,
    };
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const sql = getDbClient();

    const [existing] = await sql`
      SELECT * FROM api_keys
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!existing) {
      return reply.code(404).send({ error: 'API key not found' });
    }

    await sql`
      UPDATE api_keys
      SET revoked_at = NOW()
      WHERE id = ${id}
    `;

    return { success: true, message: 'API key revoked' };
  });

  fastify.get('/project/:projectId', async (request) => {
    const { projectId } = request.params as { projectId: string };

    const sql = getDbClient();
    const apiKeys = await sql`
      SELECT 
        id,
        name,
        project_id as "projectId",
        created_at as "createdAt",
        last_used_at as "lastUsedAt",
        revoked_at as "revokedAt"
      FROM api_keys
      WHERE project_id = ${projectId}
    `;

    return { apiKeys };
  });
};
