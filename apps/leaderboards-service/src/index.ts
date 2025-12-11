import { createDbClient } from '@ascend/db';
import { createNatsClient } from '@ascend/nats-client';
import { startService } from '@ascend/service-utils';
import { leaderboardsRoutes } from './routes/leaderboards.js';
import { seasonsRoutes } from './routes/seasons.js';

startService({
  name: 'leaderboards-service',
  port: 3003,
  title: 'Ascend Leaderboards Service API',
  description: 'Leaderboard and season management (control plane)',
  tags: [
    { name: 'leaderboards', description: 'Leaderboard CRUD operations' },
    { name: 'seasons', description: 'Season management' },
  ],
  envSchema: {
    type: 'object',
    required: ['DATABASE_URL', 'NATS_URL', 'INTERNAL_API_SECRET'],
    properties: {
      PORT: { type: 'number', default: 3003 },
      DATABASE_URL: { type: 'string' },
      NATS_URL: { type: 'string' },
      INTERNAL_API_SECRET: { type: 'string' },
    },
  },
  requiresInternalAuth: true,
  onInit: async (config) => {
    const { DATABASE_URL, NATS_URL } = config as {
      DATABASE_URL: string;
      NATS_URL: string;
    };
    createDbClient(DATABASE_URL);
    await createNatsClient(NATS_URL);
  },
  routes: [
    { plugin: leaderboardsRoutes, prefix: '/leaderboards' },
    { plugin: seasonsRoutes, prefix: '/seasons' },
  ],
});
