# Environment Variables

## Overview

The project uses a `.env` file in the project root for all environment configuration.

## Loading Strategy

- **Services** (Fastify apps): Use `@fastify/env` plugin to load and validate env vars
- **Database Scripts**: Use `dotenv` to load `.env` from project root
- **Drizzle Kit**: Loads `.env` automatically via `drizzle.config.ts`

## Required Variables

```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ascend

# Redis
REDIS_URL=redis://localhost:6379

# Service Ports
AUTH_SERVICE_PORT=3001
GATEWAY_PORT=3000
SCORES_SERVICE_PORT=3002
LEADERBOARDS_SERVICE_PORT=3003
WORKER_SERVICE_PORT=3004
BILLING_SERVICE_PORT=3005
ANALYTICS_SERVICE_PORT=3006
```

## Usage

### From Services

Services use `@fastify/env` which automatically loads from `.env`:

```typescript
await fastify.register(env, {
  schema: envSchema,
  dotenv: true, // Loads .env file
});

// Access via fastify.config
const port = fastify.config.PORT;
```

### From Database Scripts

Migration and other DB scripts use `dotenv`:

```typescript
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(process.cwd(), '.env') });

// Now process.env.DATABASE_URL is available
```

### From Drizzle Kit

Drizzle config automatically loads `.env`:

```typescript
// drizzle.config.ts
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

## Development vs Production

### Development

Use `.env` file in project root (gitignored):

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ascend
```

### Production

Set environment variables directly in your deployment platform:

- Docker: Use `docker-compose.yml` or Kubernetes ConfigMaps/Secrets
- Cloud: Use platform-specific env var configuration
- CI/CD: Use GitHub Actions secrets

## Security

- ✅ `.env` is in `.gitignore` - never commit secrets
- ✅ Use `.env.example` as a template with dummy values
- ✅ API keys are hashed before storage (bcrypt)
- ✅ Production should use secrets management (AWS Secrets Manager, etc.)

## Troubleshooting

### Migration can't connect to database

```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Or check .env file
cat .env | grep DATABASE_URL

# Run with explicit env var
DATABASE_URL="postgres://..." pnpm db:migrate
```

### Service can't read env vars

Make sure `.env` exists in project root:

```bash
ls -la .env
# Should exist

# Copy from example if missing
cp .env.example .env
```

### Wrong database credentials

Default credentials from `infra/docker-compose.yml`:

- Username: `postgres`
- Password: `postgres`
- Database: `ascend`
- Host: `localhost`
- Port: `5432`

Full connection string:

```
postgres://postgres:postgres@localhost:5432/ascend
```
