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
        // Get metadata for TTL and updateMode
        const metadata = await redis.hgetall(metadataKey);
        const ttlDays = metadata?.ttlDays ? parseInt(metadata.ttlDays) : 0;
        const updateMode = (metadata?.updateMode || 'replace') as
          | 'replace'
          | 'increment'
          | 'best';
        const sortOrder = (metadata?.sortOrder || 'desc') as 'asc' | 'desc';

        // Apply update based on updateMode from leaderboard config
        if (updateMode === 'increment' || increment) {
          // Increment: add to existing score
          await redis.zincrby(redisKey, score, userId);
        } else if (updateMode === 'best') {
          // Best: only update if new score is better
          const currentScore = await redis.zscore(redisKey, userId);

          if (currentScore === null) {
            // No existing score, add it
            await redis.zadd(redisKey, score, userId);
          } else {
            const current = parseFloat(currentScore);
            const shouldUpdate =
              sortOrder === 'desc'
                ? score > current // Higher is better
                : score < current; // Lower is better

            if (shouldUpdate) {
              await redis.zadd(redisKey, score, userId);
            }
          }
        } else {
          // Replace: always overwrite with new score
          await redis.zadd(redisKey, score, userId);
        }

        // Set or refresh TTL if configured
        if (ttlDays > 0) {
          const ttlSeconds = ttlDays * 24 * 60 * 60;
          await redis.expire(redisKey, ttlSeconds);
        }

        const finalScore = await redis.zscore(redisKey, userId);
        const rank =
          sortOrder === 'desc'
            ? await redis.zrevrank(redisKey, userId)
            : await redis.zrank(redisKey, userId);

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

      // Collect unique leaderboards to fetch metadata
      const uniqueLeaderboards = new Set(updates.map((u) => u.leaderboardId));
      const leaderboardMetadata = new Map<
        string,
        {
          ttlDays: number;
          updateMode: 'replace' | 'increment' | 'best';
          sortOrder: 'asc' | 'desc';
        }
      >();

      // Fetch metadata for all unique leaderboards
      for (const leaderboardId of uniqueLeaderboards) {
        const metadataKey = `l:meta:${tenantId}:${projectId}:${leaderboardId}`;
        const metadata = await redis.hgetall(metadataKey);
        const ttlDays = metadata?.ttlDays ? parseInt(metadata.ttlDays) : 0;
        const updateMode = (metadata?.updateMode || 'replace') as
          | 'replace'
          | 'increment'
          | 'best';
        const sortOrder = (metadata?.sortOrder || 'desc') as 'asc' | 'desc';
        leaderboardMetadata.set(leaderboardId, {
          ttlDays,
          updateMode,
          sortOrder,
        });
      }

      // For 'best' mode, we need to fetch current scores first
      // This is less efficient but necessary for correctness
      const currentScores = new Map<string, number>();
      for (const update of updates) {
        const lbMeta = leaderboardMetadata.get(update.leaderboardId);
        if (lbMeta?.updateMode === 'best') {
          const redisKey = `l:${tenantId}:${projectId}:${update.leaderboardId}`;
          const scoreKey = `${update.leaderboardId}:${update.userId}`;
          const currentScore = await redis.zscore(redisKey, update.userId);
          if (currentScore !== null) {
            currentScores.set(scoreKey, parseFloat(currentScore));
          }
        }
      }

      const pipeline = redis.pipeline();

      for (const update of updates) {
        const { leaderboardId, userId, score, increment = false } = update;
        const redisKey = `l:${tenantId}:${projectId}:${leaderboardId}`;
        const lbMeta = leaderboardMetadata.get(leaderboardId);

        if (!lbMeta) continue;

        const updateMode = lbMeta.updateMode;

        if (updateMode === 'increment' || increment) {
          pipeline.zincrby(redisKey, score, userId);
        } else if (updateMode === 'best') {
          const scoreKey = `${leaderboardId}:${userId}`;
          const currentScore = currentScores.get(scoreKey);

          if (currentScore === undefined) {
            // No existing score
            pipeline.zadd(redisKey, score, userId);
          } else {
            // Check if new score is better
            const shouldUpdate =
              lbMeta.sortOrder === 'desc'
                ? score > currentScore
                : score < currentScore;

            if (shouldUpdate) {
              pipeline.zadd(redisKey, score, userId);
            }
          }
        } else {
          pipeline.zadd(redisKey, score, userId);
        }

        // Apply TTL if configured
        if (lbMeta.ttlDays > 0) {
          const ttlSeconds = lbMeta.ttlDays * 24 * 60 * 60;
          pipeline.expire(redisKey, ttlSeconds);
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
