import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDbClient } from '@ascend/db';

interface CreateSeasonBody {
  leaderboardId: string;
  name: string;
  startDate: string;
  endDate: string;
  metadata?: Record<string, unknown>;
}

interface SeasonParams {
  id: string;
}

interface LeaderboardSeasonParams {
  leaderboardId: string;
}

export async function seasonsRoutes(fastify: FastifyInstance) {
  const sql = getDbClient();

  fastify.post<{ Body: CreateSeasonBody }>(
    '/',
    {
      schema: {
        tags: ['seasons'],
        description: 'Create a new season for a leaderboard',
        body: {
          type: 'object',
          required: ['leaderboardId', 'name', 'startDate', 'endDate'],
          properties: {
            leaderboardId: { type: 'string' },
            name: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateSeasonBody }>,
      reply: FastifyReply,
    ) => {
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      const { leaderboardId, name, startDate, endDate, metadata } =
        request.body;

      try {
        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${leaderboardId} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Leaderboard not found' });
        }

        const [season] = await sql`
          INSERT INTO seasons (
            leaderboard_id, name, start_date, end_date, metadata
          )
          VALUES (
            ${leaderboardId}, ${name}, ${new Date(startDate)}, ${new Date(endDate)},
            ${metadata ? JSON.stringify(metadata) : null}
          )
          RETURNING *
        `;

        return reply.code(201).send(season);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to create season' });
      }
    },
  );

  fastify.get<{ Params: LeaderboardSeasonParams }>(
    '/leaderboard/:leaderboardId',
    {
      schema: {
        tags: ['seasons'],
        description: 'List all seasons for a leaderboard',
        params: {
          type: 'object',
          properties: {
            leaderboardId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: LeaderboardSeasonParams }>,
      reply: FastifyReply,
    ) => {
      const { leaderboardId } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${leaderboardId} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Leaderboard not found' });
        }

        const results = await sql`
          SELECT * FROM seasons
          WHERE leaderboard_id = ${leaderboardId}
          ORDER BY start_date DESC
        `;

        return reply.send({
          seasons: results,
          total: results.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch seasons' });
      }
    },
  );

  fastify.get<{ Params: SeasonParams }>(
    '/:id',
    {
      schema: {
        tags: ['seasons'],
        description: 'Get a specific season by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: SeasonParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [season] = await sql`
          SELECT * FROM seasons
          WHERE id = ${id}
          LIMIT 1
        `;

        if (!season) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${season.leaderboard_id} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        return reply.send(season);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch season' });
      }
    },
  );

  fastify.patch<{ Params: SeasonParams; Body: { isActive: boolean } }>(
    '/:id/activate',
    {
      schema: {
        tags: ['seasons'],
        description: 'Activate or deactivate a season',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['isActive'],
          properties: {
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: SeasonParams;
        Body: { isActive: boolean };
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { isActive } = request.body;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [season] = await sql`
          SELECT * FROM seasons
          WHERE id = ${id}
          LIMIT 1
        `;

        if (!season) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${season.leaderboard_id} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        const [updatedSeason] = await sql`
          UPDATE seasons
          SET is_active = ${isActive}
          WHERE id = ${id}
          RETURNING *
        `;

        return reply.send(updatedSeason);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update season' });
      }
    },
  );

  fastify.delete<{ Params: SeasonParams }>(
    '/:id',
    {
      schema: {
        tags: ['seasons'],
        description: 'Delete a season',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: SeasonParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const projectId = request.projectId;

      if (!projectId) {
        return reply.code(400).send({ error: 'Missing project context' });
      }

      try {
        const [season] = await sql`
          SELECT * FROM seasons
          WHERE id = ${id}
          LIMIT 1
        `;

        if (!season) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        const [leaderboard] = await sql`
          SELECT * FROM leaderboards
          WHERE id = ${season.leaderboard_id} AND project_id = ${projectId}
          LIMIT 1
        `;

        if (!leaderboard) {
          return reply.code(404).send({ error: 'Season not found' });
        }

        await sql`
          DELETE FROM seasons
          WHERE id = ${id}
        `;

        return reply.send({
          success: true,
          message: 'Season deleted successfully',
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to delete season' });
      }
    },
  );
}
