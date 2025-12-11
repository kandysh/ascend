import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDbClient } from '@ascend/db';

interface RecordUsageBody {
  tenantId: string;
  projectId: string;
  scoreUpdates?: number;
  leaderboardReads?: number;
}

interface UsageQuerystring {
  startDate?: string;
  endDate?: string;
}

export async function usageRoutes(fastify: FastifyInstance) {
  const sql = getDbClient();

  fastify.post<{ Body: RecordUsageBody }>(
    '/record',
    {
      schema: {
        tags: ['usage'],
        description: 'Record usage for a tenant/project',
        body: {
          type: 'object',
          required: ['tenantId', 'projectId'],
          properties: {
            tenantId: { type: 'string' },
            projectId: { type: 'string' },
            scoreUpdates: { type: 'number', default: 0 },
            leaderboardReads: { type: 'number', default: 0 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RecordUsageBody }>,
      reply: FastifyReply,
    ) => {
      const {
        tenantId,
        projectId,
        scoreUpdates = 0,
        leaderboardReads = 0,
      } = request.body;

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalRequests = scoreUpdates + leaderboardReads;

        // Upsert usage record for today
        const [usage] = await sql`
          INSERT INTO usage_records (
            tenant_id, project_id, date, score_updates, leaderboard_reads, total_requests
          )
          VALUES (
            ${tenantId}, ${projectId}, ${today}, ${scoreUpdates}, ${leaderboardReads}, ${totalRequests}
          )
          ON CONFLICT (tenant_id, project_id, date)
          DO UPDATE SET
            score_updates = usage_records.score_updates + ${scoreUpdates},
            leaderboard_reads = usage_records.leaderboard_reads + ${leaderboardReads},
            total_requests = usage_records.total_requests + ${totalRequests}
          RETURNING *
        `;

        return reply.code(201).send(usage);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to record usage' });
      }
    },
  );

  fastify.get<{ Params: { tenantId: string }; Querystring: UsageQuerystring }>(
    '/tenant/:tenantId',
    {
      schema: {
        tags: ['usage'],
        description: 'Get usage records for a tenant',
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { tenantId: string };
        Querystring: UsageQuerystring;
      }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.params;
      const { startDate, endDate } = request.query;

      try {
        let query;

        if (startDate && endDate) {
          query = sql`
            SELECT * FROM usage_records
            WHERE tenant_id = ${tenantId}
              AND date >= ${new Date(startDate)}
              AND date <= ${new Date(endDate)}
            ORDER BY date DESC
          `;
        } else {
          // Default: last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          query = sql`
            SELECT * FROM usage_records
            WHERE tenant_id = ${tenantId}
              AND date >= ${thirtyDaysAgo}
            ORDER BY date DESC
          `;
        }

        const records = await query;

        // Calculate totals
        const totals = records.reduce(
          (acc, record) => ({
            scoreUpdates: acc.scoreUpdates + record.score_updates,
            leaderboardReads: acc.leaderboardReads + record.leaderboard_reads,
            totalRequests: acc.totalRequests + record.total_requests,
          }),
          { scoreUpdates: 0, leaderboardReads: 0, totalRequests: 0 },
        );

        return reply.send({
          records,
          totals,
          count: records.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch usage' });
      }
    },
  );

  fastify.get<{ Params: { projectId: string }; Querystring: UsageQuerystring }>(
    '/project/:projectId',
    {
      schema: {
        tags: ['usage'],
        description: 'Get usage records for a project',
        params: {
          type: 'object',
          properties: {
            projectId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: UsageQuerystring;
      }>,
      reply: FastifyReply,
    ) => {
      const { projectId } = request.params;
      const { startDate, endDate } = request.query;

      try {
        let query;

        if (startDate && endDate) {
          query = sql`
            SELECT * FROM usage_records
            WHERE project_id = ${projectId}
              AND date >= ${new Date(startDate)}
              AND date <= ${new Date(endDate)}
            ORDER BY date DESC
          `;
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          query = sql`
            SELECT * FROM usage_records
            WHERE project_id = ${projectId}
              AND date >= ${thirtyDaysAgo}
            ORDER BY date DESC
          `;
        }

        const records = await query;

        const totals = records.reduce(
          (acc, record) => ({
            scoreUpdates: acc.scoreUpdates + record.score_updates,
            leaderboardReads: acc.leaderboardReads + record.leaderboard_reads,
            totalRequests: acc.totalRequests + record.total_requests,
          }),
          { scoreUpdates: 0, leaderboardReads: 0, totalRequests: 0 },
        );

        return reply.send({
          records,
          totals,
          count: records.length,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch usage' });
      }
    },
  );

  fastify.get(
    '/aggregate/tenant/:tenantId',
    {
      schema: {
        tags: ['usage'],
        description: 'Get aggregated usage summary for current month',
        params: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { tenantId: string } }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.params;

      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [summary] = await sql`
          SELECT 
            COALESCE(SUM(score_updates), 0) as total_score_updates,
            COALESCE(SUM(leaderboard_reads), 0) as total_leaderboard_reads,
            COALESCE(SUM(total_requests), 0) as total_requests,
            COUNT(DISTINCT date) as days_with_usage
          FROM usage_records
          WHERE tenant_id = ${tenantId}
            AND date >= ${startOfMonth}
        `;

        return reply.send({
          period: {
            start: startOfMonth.toISOString(),
            end: new Date().toISOString(),
          },
          summary: {
            scoreUpdates: Number(summary.total_score_updates),
            leaderboardReads: Number(summary.total_leaderboard_reads),
            totalRequests: Number(summary.total_requests),
            daysWithUsage: Number(summary.days_with_usage),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to aggregate usage' });
      }
    },
  );
}
