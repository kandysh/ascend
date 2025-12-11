import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';

interface ScoreUpdateBody {
  leaderboardId: string;
  userId: string;
  score: number;
  increment?: boolean;
  metadata?: Record<string, string>;
}

interface BatchScoreUpdateBody {
  updates: Array<{
    leaderboardId: string;
    userId: string;
    score: number;
    increment?: boolean;
  }>;
}

export async function scoresRoutes(fastify: FastifyInstance) {
  const redis = getRedisClient();

  fastify.post<{ Body: ScoreUpdateBody }>(
    '/update',
    {
      schema: {
        tags: ['scores'],
        description: 'Update a user score on a leaderboard',
        body: {
          type: 'object',
          required: ['leaderboardId', 'userId', 'score'],
          properties: {
            leaderboardId: { type: 'string' },
            userId: { type: 'string' },
            score: { type: 'number' },
            increment: { type: 'boolean', default: false },
            metadata: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              userId: { type: 'string' },
              score: { type: 'number' },
              rank: { type: 'number', nullable: true },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: ScoreUpdateBody }>,
      reply: FastifyReply,
    ) => {
      const { leaderboardId, userId, score, increment = false } = request.body;
      const tenantId = request.tenantId;
      const projectId = request.projectId;

      if (!tenantId || !projectId) {
        return reply
          .code(400)
          .send({ error: 'Missing tenant or project context' });
      }

      const redisKey = `l:${tenantId}:${projectId}:${leaderboardId}`;

      try {
        if (increment) {
          await redis.zincrby(redisKey, score, userId);
        } else {
          await redis.zadd(redisKey, score, userId);
        }

        const finalScore = await redis.zscore(redisKey, userId);
        const rank = await redis.zrevrank(redisKey, userId);

        publishScoreEvent({
          tenantId,
          projectId,
          leaderboardId,
          userId,
          score: parseFloat(finalScore || '0'),
          increment,
          timestamp: new Date().toISOString(),
        });

        return reply.send({
          success: true,
          userId,
          score: parseFloat(finalScore || '0'),
          rank: rank !== null ? rank + 1 : null,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to update score' });
      }
    },
  );

  fastify.post<{ Body: BatchScoreUpdateBody }>(
    '/batch-update',
    {
      schema: {
        tags: ['scores'],
        description: 'Update multiple user scores in batch',
        body: {
          type: 'object',
          required: ['updates'],
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                required: ['leaderboardId', 'userId', 'score'],
                properties: {
                  leaderboardId: { type: 'string' },
                  userId: { type: 'string' },
                  score: { type: 'number' },
                  increment: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              processed: { type: 'number' },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    leaderboardId: { type: 'string' },
                    success: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: BatchScoreUpdateBody }>,
      reply: FastifyReply,
    ) => {
      const { updates } = request.body;
      const tenantId = request.tenantId;
      const projectId = request.projectId;

      if (!tenantId || !projectId) {
        return reply
          .code(400)
          .send({ error: 'Missing tenant or project context' });
      }

      const results = [];
      const pipeline = redis.pipeline();

      for (const update of updates) {
        const { leaderboardId, userId, score, increment = false } = update;
        const redisKey = `l:${tenantId}:${projectId}:${leaderboardId}`;

        if (increment) {
          pipeline.zincrby(redisKey, score, userId);
        } else {
          pipeline.zadd(redisKey, score, userId);
        }

        results.push({
          userId,
          leaderboardId,
          success: true,
        });

        publishScoreEvent({
          tenantId,
          projectId,
          leaderboardId,
          userId,
          score,
          increment,
          timestamp: new Date().toISOString(),
        });
      }

      try {
        await pipeline.exec();

        return reply.send({
          success: true,
          processed: updates.length,
          results,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ error: 'Failed to process batch update' });
      }
    },
  );
}

function publishScoreEvent(event: {
  tenantId: string;
  projectId: string;
  leaderboardId: string;
  userId: string;
  score: number;
  increment: boolean;
  timestamp: string;
}) {
  console.log('[EVENT] score.updated', JSON.stringify(event));
}
