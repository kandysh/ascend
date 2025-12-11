import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';
import { generateApiKey, hashApiKey } from '@ascend/utils';

const apiKeySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    projectId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
    lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
    revokedAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const apiKeyWithSecretSchema = {
  type: 'object',
  properties: {
    apiKey: { type: 'string', description: 'The API key (only shown once)' },
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    projectId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const apiKeysRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new API key',
        tags: ['api-keys'],
        body: {
          type: 'object',
          required: ['projectId', 'name'],
          properties: {
            projectId: {
              type: 'string',
              format: 'uuid',
              description: 'Project ID',
            },
            name: { type: 'string', description: 'API key name' },
          },
        },
        response: {
          200: apiKeyWithSecretSchema,
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { projectId, name } = request.body as {
        projectId: string;
        name: string;
      };

      if (!projectId || !name) {
        return reply
          .code(400)
          .send({ error: 'ProjectId and name are required' });
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
    },
  );

  fastify.post(
    '/:id/rotate',
    {
      schema: {
        description: 'Rotate an API key (revoke old, create new)',
        tags: ['api-keys'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'API key ID' },
          },
        },
        response: {
          200: apiKeyWithSecretSchema,
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );

  fastify.delete(
    '/:id',
    {
      schema: {
        description: 'Revoke an API key',
        tags: ['api-keys'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'API key ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
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
    },
  );

  fastify.get(
    '/project/:projectId',
    {
      schema: {
        description: 'List all API keys for a project',
        tags: ['api-keys'],
        params: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              format: 'uuid',
              description: 'Project ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              apiKeys: {
                type: 'array',
                items: apiKeySchema,
              },
            },
          },
        },
      },
    },
    async (request) => {
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
    },
  );
};
