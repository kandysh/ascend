import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisClient } from '@ascend/redis-client';

interface TopParams {
  id: string;
}

interface TopQuery {
  limit?: number;
  offset?: number;
}

interface RankParams {
  id: string;
  userId: string;
}

interface RankQuery {
  withNeighbors?: boolean;
  neighborCount?: number;
}

export async function leaderboardsRoutes(fastify: FastifyInstance) {
  const redis = getRedisClient();

  fastify.get<{ Params: TopParams; Querystring: TopQuery }>(
    '/:id/top',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Get top N users from a leaderboard',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10, minimum: 1, maximum: 100 },
            offset: { type: 'number', default: 0, minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              leaderboardId: { type: 'string' },
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rank: { type: 'number' },
                    userId: { type: 'string' },
                    score: { type: 'number' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: TopParams; Querystring: TopQuery }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { limit = 10, offset = 0 } = request.query;
      const tenantId = request.tenantId;
      const projectId = request.projectId;

      if (!tenantId || !projectId) {
        return reply
          .code(400)
          .send({ error: 'Missing tenant or project context' });
      }

      const redisKey = `l:${tenantId}:${projectId}:${id}`;

      try {
        const start = offset;
        const stop = offset + limit - 1;

        const results = await redis.zrevrange(
          redisKey,
          start,
          stop,
          'WITHSCORES',
        );
        const total = await redis.zcard(redisKey);

        const entries = [];
        for (let i = 0; i < results.length; i += 2) {
          entries.push({
            rank: offset + i / 2 + 1,
            userId: results[i],
            score: parseFloat(results[i + 1]),
          });
        }

        return reply.send({
          leaderboardId: id,
          entries,
          total,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply
          .code(500)
          .send({ error: 'Failed to fetch leaderboard data' });
      }
    },
  );

  fastify.get<{ Params: RankParams; Querystring: RankQuery }>(
    '/:id/rank/:userId',
    {
      schema: {
        tags: ['leaderboards'],
        description: 'Get rank and score for a specific user',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            withNeighbors: { type: 'boolean', default: false },
            neighborCount: {
              type: 'number',
              default: 2,
              minimum: 1,
              maximum: 10,
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              leaderboardId: { type: 'string' },
              userId: { type: 'string' },
              rank: { type: 'number', nullable: true },
              score: { type: 'number', nullable: true },
              neighbors: {
                type: 'object',
                nullable: true,
                properties: {
                  above: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        rank: { type: 'number' },
                        userId: { type: 'string' },
                        score: { type: 'number' },
                      },
                    },
                  },
                  below: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        rank: { type: 'number' },
                        userId: { type: 'string' },
                        score: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: RankParams; Querystring: RankQuery }>,
      reply: FastifyReply,
    ) => {
      const { id, userId } = request.params;
      const { withNeighbors = false, neighborCount = 2 } = request.query;
      const tenantId = request.tenantId;
      const projectId = request.projectId;

      if (!tenantId || !projectId) {
        return reply
          .code(400)
          .send({ error: 'Missing tenant or project context' });
      }

      const redisKey = `l:${tenantId}:${projectId}:${id}`;

      try {
        const score = await redis.zscore(redisKey, userId);
        const rank = await redis.zrevrank(redisKey, userId);

        if (score === null || rank === null) {
          return reply.send({
            leaderboardId: id,
            userId,
            rank: null,
            score: null,
            neighbors: null,
          });
        }

        const result: {
          leaderboardId: string;
          userId: string;
          rank: number;
          score: number;
          neighbors: {
            above: Array<{ rank: number; userId: string; score: number }>;
            below: Array<{ rank: number; userId: string; score: number }>;
          } | null;
        } = {
          leaderboardId: id,
          userId,
          rank: rank + 1,
          score: parseFloat(score),
          neighbors: null,
        };

        if (withNeighbors) {
          const aboveStart = Math.max(0, rank - neighborCount);
          const aboveStop = Math.max(0, rank - 1);
          const belowStart = rank + 1;
          const belowStop = rank + neighborCount;

          const above =
            rank > 0
              ? await redis.zrevrange(
                  redisKey,
                  aboveStart,
                  aboveStop,
                  'WITHSCORES',
                )
              : [];
          const below = await redis.zrevrange(
            redisKey,
            belowStart,
            belowStop,
            'WITHSCORES',
          );

          const aboveEntries = [];
          for (let i = 0; i < above.length; i += 2) {
            aboveEntries.push({
              rank: aboveStart + i / 2 + 1,
              userId: above[i],
              score: parseFloat(above[i + 1]),
            });
          }

          const belowEntries = [];
          for (let i = 0; i < below.length; i += 2) {
            belowEntries.push({
              rank: belowStart + i / 2 + 1,
              userId: below[i],
              score: parseFloat(below[i + 1]),
            });
          }

          result.neighbors = {
            above: aboveEntries,
            below: belowEntries,
          };
        }

        return reply.send(result);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: 'Failed to fetch user rank' });
      }
    },
  );
}
