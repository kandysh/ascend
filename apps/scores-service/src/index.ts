import { createRedisClient } from '@ascend/redis-client';
import { createNatsClient } from '@ascend/nats-client';
import { startService } from '@ascend/service-utils';
import { scoresRoutes } from './routes/scores.js';
import { leaderboardsRoutes } from './routes/leaderboards.js';

startService({
  name: 'scores-service',
  port: 3002,
  title: 'Ascend Scores Service API',
  description: 'Real-time score updates and leaderboard queries',
  tags: [
    { name: 'scores', description: 'Score management' },
    { name: 'leaderboards', description: 'Leaderboard queries' },
  ],
  envSchema: {
    type: 'object',
    required: ['REDIS_URL', 'NATS_URL', 'INTERNAL_API_SECRET'],
    properties: {
      PORT: { type: 'number', default: 3002 },
      REDIS_URL: { type: 'string' },
      NATS_URL: { type: 'string' },
      INTERNAL_API_SECRET: { type: 'string' },
    },
  },
  requiresInternalAuth: true,
  onInit: async (config) => {
    const { REDIS_URL, NATS_URL } = config as {
      REDIS_URL: string;
      NATS_URL: string;
    };
    createRedisClient(REDIS_URL);
    await createNatsClient(NATS_URL);
  },
  routes: [
    { plugin: scoresRoutes, prefix: '/scores' },
    { plugin: leaderboardsRoutes, prefix: '/leaderboards' },
  ],
});
