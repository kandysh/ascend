import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';

export const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
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
  });

  fastify.get('/:id', async (request, reply) => {
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
  });

  fastify.get('/', async () => {
    const sql = getDbClient();
    const tenants = await sql`
      SELECT * FROM tenants
    `;

    return { tenants };
  });
};
