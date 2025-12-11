import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';
import {
  publishEvent,
  ScoreUpdatedEvent,
  EventSubjects,
} from '@ascend/nats-client';

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
      const metadataKey = `l:meta:${tenantId}:${projectId}:${leaderboardId}`;

      try {
        // Get TTL from metadata if it exists
        const metadata = await redis.hgetall(metadataKey);
        const ttlDays = metadata?.ttlDays ? parseInt(metadata.ttlDays) : 0;

        if (increment) {
          await redis.zincrby(redisKey, score, userId);
        } else {
          await redis.zadd(redisKey, score, userId);
        }

        // Set or refresh TTL if configured
        if (ttlDays > 0) {
          const ttlSeconds = ttlDays * 24 * 60 * 60;
          await redis.expire(redisKey, ttlSeconds);
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

function publishScoreEvent(event: ScoreUpdatedEvent) {
  // Publish to NATS
  publishEvent(EventSubjects.SCORE_UPDATED, event).catch((error) => {
    console.error('[EVENT] Failed to publish score.updated:', error);
  });
}
