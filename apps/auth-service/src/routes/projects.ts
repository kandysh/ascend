import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';

const projectSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    tenant_id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new project',
        tags: ['projects'],
        body: {
          type: 'object',
          required: ['tenantId', 'name'],
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Tenant ID' },
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Project description' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              project: projectSchema,
            },
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
      const { tenantId, name, description } = request.body as {
        tenantId: string;
        name: string;
        description?: string;
      };

      if (!tenantId || !name) {
        return reply.code(400).send({ error: 'TenantId and name are required' });
      }

      const sql = getDbClient();

      const [project] = await sql`
      INSERT INTO projects (tenant_id, name, description)
      VALUES (${tenantId}, ${name}, ${description || null})
      RETURNING *
    `;

      return { project };
    },
  );

  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get project by ID',
        tags: ['projects'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Project ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              project: projectSchema,
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
      const [project] = await sql`
      SELECT * FROM projects
      WHERE id = ${id}
      LIMIT 1
    `;

      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      return { project };
    },
  );

  fastify.get(
    '/tenant/:tenantId',
    {
      schema: {
        description: 'List all projects for a tenant',
        tags: ['projects'],
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid', description: 'Tenant ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              projects: {
                type: 'array',
                items: projectSchema,
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { tenantId } = request.params as { tenantId: string };

      const sql = getDbClient();
      const projects = await sql`
      SELECT * FROM projects
      WHERE tenant_id = ${tenantId}
    `;

      return { projects };
    },
  );
};
