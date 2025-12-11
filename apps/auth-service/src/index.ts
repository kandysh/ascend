import { createDbClient } from '@ascend/db';
import { startService } from '@ascend/service-utils';
import { apiKeysRoutes } from './routes/api-keys.js';
import { projectsRoutes } from './routes/projects.js';
import { tenantsRoutes } from './routes/tenants.js';
import { validateRoutes } from './routes/validate.js';

startService({
  name: 'auth-service',
  port: 3001,
  title: 'Ascend Auth Service API',
  description: 'Authentication, tenant, and API key management',
  tags: [
    { name: 'tenants', description: 'Tenant management' },
    { name: 'projects', description: 'Project management' },
    { name: 'api-keys', description: 'API key management' },
    { name: 'validation', description: 'API key validation' },
  ],
  envSchema: {
    type: 'object',
    required: ['DATABASE_URL'],
    properties: {
      PORT: { type: 'number', default: 3001 },
      DATABASE_URL: { type: 'string' },
    },
  },
  onInit: (config) => {
    createDbClient((config as { DATABASE_URL: string }).DATABASE_URL);
  },
  routes: [
    { plugin: tenantsRoutes, prefix: '/tenants' },
    { plugin: projectsRoutes, prefix: '/projects' },
    { plugin: apiKeysRoutes, prefix: '/api-keys' },
    { plugin: validateRoutes, prefix: '/validate' },
  ],
});
