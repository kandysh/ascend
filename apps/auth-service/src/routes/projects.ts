import { FastifyPluginAsync } from 'fastify';
import { getDbClient } from '@ascend/db';

export const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', async (request, reply) => {
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
  });

  fastify.get('/:id', async (request, reply) => {
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
  });

  fastify.get('/tenant/:tenantId', async (request) => {
    const { tenantId } = request.params as { tenantId: string };

    const sql = getDbClient();
    const projects = await sql`
      SELECT * FROM projects
      WHERE tenant_id = ${tenantId}
    `;

    return { projects };
  });
};
