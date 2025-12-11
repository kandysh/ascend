import { createDbClient } from '@ascend/db';
import { startService } from '@ascend/service-utils';
import { subscriptionsRoutes } from './routes/subscriptions.js';
import { usageRoutes } from './routes/usage.js';

startService({
  name: 'billing-service',
  port: 3005,
  title: 'Ascend Billing Service',
  description: 'Billing and usage tracking API',
  tags: [
    { name: 'subscriptions', description: 'Subscription management' },
    { name: 'usage', description: 'Usage tracking and reporting' },
  ],
  envSchema: {
    type: 'object',
    required: ['DATABASE_URL', 'INTERNAL_API_SECRET'],
    properties: {
      PORT: { type: 'number', default: 3005 },
      DATABASE_URL: { type: 'string' },
      INTERNAL_API_SECRET: { type: 'string' },
    },
  },
  requiresInternalAuth: true,
  onInit: (config) => {
    createDbClient((config as { DATABASE_URL: string }).DATABASE_URL);
  },
  routes: [
    { plugin: subscriptionsRoutes, prefix: '/subscriptions' },
    { plugin: usageRoutes, prefix: '/usage' },
  ],
});
