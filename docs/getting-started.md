# Getting Started with Ascend

A complete leaderboard SaaS platform built with microservices architecture.

## Prerequisites

- Node.js 25+
- pnpm 10+
- Docker & Docker Compose

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
pnpm infra:start

# Or use the helper script
./infra/start.sh
```

Wait for services to be healthy (usually 5-10 seconds).

### 3. Run Database Migrations

```bash
pnpm db:migrate
```

### 4. Start Auth Service

```bash
cd apps/auth-service
pnpm dev
```

The service will start on http://localhost:3001

## Available Scripts

### Infrastructure Management
```bash
pnpm infra:start     # Start PostgreSQL & Redis
pnpm infra:stop      # Stop all infrastructure
pnpm infra:restart   # Restart infrastructure
pnpm infra:logs      # View logs
pnpm infra:clean     # Stop and remove all data
```

### Database
```bash
pnpm db:generate     # Generate migration from schema changes
pnpm db:migrate      # Run pending migrations
pnpm db:studio       # Open Drizzle Studio GUI
```

### Development
```bash
pnpm build           # Build all packages
pnpm dev             # Watch and rebuild packages
pnpm lint            # Lint code
pnpm format          # Format code with Prettier
```

## Testing the Auth Service

### Create a Tenant
```bash
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com"}'
```

Response:
```json
{
  "tenant": {
    "id": "...",
    "name": "Acme Corp",
    "email": "admin@acme.com",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### Create a Project
```bash
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<tenant-id-from-above>",
    "name": "My Game",
    "description": "Production game server"
  }'
```

### Create an API Key
```bash
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<project-id-from-above>",
    "name": "Production Key"
  }'
```

Response includes the **actual API key** (only shown once):
```json
{
  "apiKey": "ak_...",
  "id": "...",
  "name": "Production Key",
  "projectId": "...",
  "createdAt": "..."
}
```

### Validate the API Key
```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "ak_..."}'
```

Response:
```json
{
  "valid": true,
  "tenantId": "...",
  "projectId": "..."
}
```

## Project Structure

```
ascend/
├── apps/
│   └── auth-service/        # Auth & tenant management
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── db/                  # Database client & schema
│   ├── redis-client/        # Redis wrapper
│   ├── utils/               # Shared utilities
│   └── sdk-js/              # JavaScript SDK
├── infra/
│   ├── docker-compose.yml   # Local infrastructure
│   ├── start.sh             # Helper script
│   └── README.md            # Infrastructure docs
└── docs/
    ├── roadmap.md           # Development roadmap
    └── database-architecture.md
```

## Optional GUI Tools

Start database management interfaces:

```bash
cd infra
docker compose up -d pgadmin redis-commander
```

- **pgAdmin**: http://localhost:5050
  - Email: `admin@ascend.local`
  - Password: `admin`
  
- **Redis Commander**: http://localhost:8081

- **Drizzle Studio**: `pnpm db:studio`

## Environment Variables

All services use the `.env` file in the project root:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ascend
REDIS_URL=redis://localhost:6379
AUTH_SERVICE_PORT=3001
```

## Next Steps

1. ✅ Phase 0 & 1 Complete - Auth Service running
2. 🔄 Phase 2 - Build API Gateway (next)
3. 📋 Phase 3+ - See `docs/roadmap.md`

## Troubleshooting

### Port Already in Use

If PostgreSQL or Redis ports are in use, modify `infra/docker-compose.yml`:

```yaml
ports:
  - '15432:5432'  # Custom PostgreSQL port
```

Update `.env`:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:15432/ascend
```

### Database Connection Issues

```bash
# Check if services are running
docker compose ps

# View logs
pnpm infra:logs

# Restart infrastructure
pnpm infra:restart
```

### Clean Slate

```bash
pnpm infra:clean    # Remove all data
pnpm infra:start    # Start fresh
pnpm db:migrate     # Run migrations
```

## Learn More

- [Database Architecture](./docs/database-architecture.md)
- [Auth Service README](./apps/auth-service/README.md)
- [Development Roadmap](./docs/roadmap.md)
