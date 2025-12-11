import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';

const tenantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new tenant',
        tags: ['tenants'],
        body: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', description: 'Tenant name' },
            email: { type: 'string', format: 'email', description: 'Tenant email' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tenant: tenantSchema,
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
      const { name, email } = request.body as { name: string; email: string };

      if (!name || !email) {
        return reply.code(400).send({ error: 'Name and email are required' });
      }

      const sql = getDbClient();

      const [tenant] = await sql`
      INSERT INTO tenants (name, email)
      VALUES (${name}, ${email})
      RETURNING *
    `;

      return { tenant };
    },
  );

  fastify.get(
    '/:id',
    {
      schema: {
        description: 'Get tenant by ID',
        tags: ['tenants'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'Tenant ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tenant: tenantSchema,
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
      const [tenant] = await sql`
      SELECT * FROM tenants
      WHERE id = ${id}
      LIMIT 1
    `;

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant not found' });
      }

      return { tenant };
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        description: 'List all tenants',
        tags: ['tenants'],
        response: {
          200: {
            type: 'object',
            properties: {
              tenants: {
                type: 'array',
                items: tenantSchema,
              },
            },
          },
        },
      },
    },
    async () => {
      const sql = getDbClient();
      const tenants = await sql`
      SELECT * FROM tenants
    `;

      return { tenants };
    },
  );
};
