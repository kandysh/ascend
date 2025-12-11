import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDbClient } from '@ascend/db';

interface CreateLeaderboardBody {
  name: string;
  description?: string;
  sortOrder?: 'asc' | 'desc';
  updateMode?: 'replace' | 'increment' | 'best';
  resetSchedule?: string;
  ttlDays?: number;
  metadata?: Record<string, unknown>;
}

interface UpdateLeaderboardBody {
  name?: string;
  description?: string;
  sortOrder?: 'asc' | 'desc';
  updateMode?: 'replace' | 'increment' | 'best';
  resetSchedule?: string;
  ttlDays?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

interface LeaderboardParams {
  id: string;
}

export async function leaderboardsRoutes(fastify: FastifyInstance) {
  const sql = getDbClient();

  fastify.post<{ Body: CreateLeaderboardBody }>(
    '/',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Create a new leaderboard',
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
            updateMode: {
              type: 'string',
              enum: ['replace', 'increment', 'best'],
              default: 'best',
            },
            resetSchedule: { type: 'string' },
            ttlDays: { type: 'number' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateLeaderboardBody }>,
      reply: FastifyReply,
    ) => {
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      const {
        name,
        description,
        sortOrder = 'desc',
        updateMode = 'best',
        resetSchedule,
        ttlDays,
        metadata,
      } = request.body;

      try {
        const [leaderboard] = await sql`
          INSERT INTO leaderboards (
            project_id, name, description, sort_order, update_mode,
            reset_schedule, ttl_days, metadata
          )
          VALUES (
            ${projectId}, ${name}, ${description || null}, ${sortOrder}, ${updateMode},
            ${resetSchedule || null}, ${ttlDays || null}, ${metadata ? JSON.stringify(metadata) : null}
          )
          RETURNING *
        `;

        publishLeaderboardEvent({
          type: 'leaderboard.created',
          leaderboardId: leaderboard.id,
          projectId,
          name: leaderboard.name,
          timestamp: new Date().toISOString(),
        });

        return reply.code(201).send(leaderboard);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create leaderboard' });
      }
    },
  );

  fastify.get(
    '/',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'List all leaderboards for a project',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const results = await sql`
          SELECT * FROM leaderboards
          WHERE project_id = ${projectId}
          ORDER BY created_at DESC
        `;

        return reply.send({
          leaderboards: results,
          total: results.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch leaderboards' });
      }
    },
  );

  fastify.get<{ Params: LeaderboardParams }>(
    '/:id',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Get a specific leaderboard by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: LeaderboardParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${id} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Leaderboard not found' });
        }

        return reply.send(leaderboard);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch leaderboard' });
      }
    },
  );

  fastify.put<{ Params: LeaderboardParams; Body: UpdateLeaderboardBody }>(
    '/:id',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Update a leaderboard',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            updateMode: {
              type: 'string',
              enum: ['replace', 'increment', 'best'],
            },
            resetSchedule: { type: 'string' },
            ttlDays: { type: 'number' },
            isActive: { type: 'boolean' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: LeaderboardParams;
        Body: UpdateLeaderboardBody;
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      const updates = request.body;

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        // Build dynamic SET clause
        const setParts: string[] = [];
        const values: (string | number | boolean | null)[] = [];

        if (updates.name !== undefined) {
          setParts.push(`name = $${values.length + 1}`);
          values.push(updates.name);
        }
        if (updates.description !== undefined) {
          setParts.push(`description = $${values.length + 1}`);
          values.push(updates.description);
        }
        if (updates.sortOrder !== undefined) {
          setParts.push(`sort_order = $${values.length + 1}`);
          values.push(updates.sortOrder);
        }
        if (updates.updateMode !== undefined) {
          setParts.push(`update_mode = $${values.length + 1}`);
          values.push(updates.updateMode);
        }
        if (updates.resetSchedule !== undefined) {
          setParts.push(`reset_schedule = $${values.length + 1}`);
          values.push(updates.resetSchedule);
        }
        if (updates.ttlDays !== undefined) {
          setParts.push(`ttl_days = $${values.length + 1}`);
          values.push(updates.ttlDays);
        }
        if (updates.isActive !== undefined) {
          setParts.push(`is_active = $${values.length + 1}`);
          values.push(updates.isActive);
        }
        if (updates.metadata !== undefined) {
          setParts.push(`metadata = $${values.length + 1}`);
          values.push(JSON.stringify(updates.metadata));
        }

        setParts.push('updated_at = NOW()');

        const setClause = setParts.join(', ');
        values.push(id, projectId);

        const [updatedLeaderboard] = await sql.unsafe(
          `
          UPDATE leaderboards
          SET ${setClause}
          WHERE id = $${values.length - 1} AND project_id = $${values.length}
          RETURNING *
        `,
          values,
        );

        if (!updatedLeaderboard) {
          return reply.code(404).send({ error: 'Leaderboard not found' });
        }

        return reply.send(updatedLeaderboard);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update leaderboard' });
      }
    },
  );

  fastify.delete<{ Params: LeaderboardParams }>(
    '/:id',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Delete a leaderboard',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: LeaderboardParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [deletedLeaderboard] = await sql`
          DELETE FROM leaderboards
          WHERE id = ${id} AND project_id = ${projectId}
          RETURNING *
        `;

        if (!deletedLeaderboard) {
          return reply.code(404).send({ error: 'Leaderboard not found' });
        }

        publishLeaderboardEvent({
          type: 'leaderboard.deleted',
          leaderboardId: id,
          projectId,
          name: deletedLeaderboard.name,
          timestamp: new Date().toISOString(),
        });

        return reply.send({
          success: true,
          message: 'Leaderboard deleted successfully',
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete leaderboard' });
      }
    },
  );
}

function publishLeaderboardEvent(event: {
  type: string;
  leaderboardId: string;
  projectId: string;
  name: string;
  timestamp: string;
}) {
  console.log(`[EVENT] ${event.type}`, JSON.stringify(event));
}
