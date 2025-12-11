# Ascend - Leaderboard SaaS Platform

A production-ready, microservices-based leaderboard platform for games and applications.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
pnpm infra:start

# 3. Run database migrations
pnpm db:migrate

# 4. Start services
pnpm service:auth      # Terminal 1 - Port 3001
pnpm service:gateway   # Terminal 2 - Port 3000
```

## Features

- **Multi-tenant Architecture** - Isolated data per tenant with project-based organization
- **API Key Management** - Secure authentication with bcrypt hashing, rotation & revocation
- **API Gateway** - Centralized entry point with auth, rate limiting, and request routing
- **Real-time Leaderboards** - Redis-backed rankings with millisecond latency
- **Event-Driven Architecture** - NATS JetStream for async processing and service communication
- **Usage Tracking & Billing** - Automated metering and plan-based rate limiting
- **Type-Safe** - Full TypeScript implementation with shared types across services
- **Modern Stack** - Fastify, PostgreSQL, Redis, NATS, Drizzle ORM

## Tech Stack

- **Runtime**: Node.js 25 + TypeScript
- **Framework**: Fastify (API services)
- **Database**: PostgreSQL 16 (Drizzle ORM + postgres.js)
- **Cache**: Redis 7 (Leaderboards, rate limiting)
- **Message Queue**: NATS JetStream (Event streaming)
- **Monorepo**: PNPM Workspaces
- **Infrastructure**: Docker Compose

## Architecture

### Services

| Service                  | Port | Status | Description                                  |
| ------------------------ | ---- | ------ | -------------------------------------------- |
| **Gateway**              | 3000 | Live   | Entry point, auth, routing, rate limiting    |
| **Auth Service**         | 3001 | Live   | Tenants, projects, API keys                  |
| **Scores Service**       | 3002 | Live   | Score updates, Redis leaderboard management  |
| **Leaderboards Service** | 3003 | Live   | Leaderboard CRUD, rankings, metadata         |
| **Worker Service**       | 3004 | Live   | Event processing, persistence, async tasks   |
| **Billing Service**      | 3005 | Live   | Usage tracking, plans, subscriptions, quotas |

### Request Flow

```
Client → Gateway (Auth + Rate Limiting)
            ↓
    Validate API Key (Auth Service)
            ↓
    Check Rate Limit (Redis Token Bucket)
            ↓
    Route to Target Service
            ↓
    Publish Events (NATS)
            ↓
    Worker Processes Events → PostgreSQL
```

### Infrastructure

| Service            | Port | Description                     |
| ------------------ | ---- | ------------------------------- |
| **PostgreSQL**     | 5432 | Primary data store              |
| **Redis**          | 6379 | Leaderboards, cache, rate limit |
| **NATS**           | 4222 | Event streaming (JetStream)     |
| **Redis GUI**      | 8081 | Redis Commander (optional)      |
| **PostgreSQL GUI** | 5050 | pgAdmin (optional)              |

## Documentation

- **[Architecture](./docs/high-level-design.md)** - Detailed system design and architecture
- **[Roadmap](./docs/roadmap.md)** - Development phases and progress
- **[Rate Limiting](./apps/gateway/RATE_LIMITING.md)** - Token bucket implementation details

## Development Commands

```bash
# Infrastructure
pnpm infra:start       # Start PostgreSQL, Redis, NATS
pnpm infra:stop        # Stop infrastructure
pnpm infra:restart     # Restart infrastructure
pnpm infra:logs        # View logs
pnpm infra:clean       # Remove all data

# Database
pnpm db:generate       # Generate migration
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Drizzle Studio (GUI)

# Services
pnpm service:auth          # Start auth service
pnpm service:gateway       # Start gateway
pnpm service:scores        # Start scores service
pnpm service:leaderboards  # Start leaderboards service
pnpm service:worker        # Start worker service
pnpm service:billing       # Start billing service

# Development
pnpm build             # Build all packages
pnpm dev               # Start all services (parallel)
pnpm lint              # Lint code
pnpm format            # Format code
pnpm format:check      # Check formatting (CI)
```

## Security

### Authentication

- **API Keys**: Bcrypt-hashed with format `ak_<base64url>`
- **Internal Services**: Secured with `X-Internal-Secret` header
- **Gateway-only Access**: Backend services not exposed publicly

### Rate Limiting

Token bucket algorithm with plan-based limits:

- **Free**: 10 req burst, 1/sec refill (86K daily)
- **Pro**: 100 req burst, 50/sec refill (4.3M daily)
- **Enterprise**: 500 req burst, 200/sec refill (17M daily)

See [Rate Limiting Documentation](./apps/gateway/RATE_LIMITING.md) for details.

## Project Structure

```
ascend/
├── apps/                       # Microservices
│   ├── auth-service/           # Authentication & tenant management
│   ├── billing-service/        # Usage tracking & billing
│   ├── gateway/                # API Gateway with rate limiting
│   ├── leaderboards-service/   # Leaderboard CRUD
│   ├── scores-service/         # Score updates & Redis rankings
│   └── worker-service/         # Event processing
├── packages/                   # Shared libraries
│   ├── db/                     # Database client & Drizzle schema
│   ├── nats-client/            # NATS wrapper & event types
│   ├── redis-client/           # Redis wrapper
│   ├── service-utils/          # Fastify server builder
│   ├── types/                  # Shared TypeScript types
│   └── utils/                  # Common utilities
├── infra/                      # Infrastructure
│   ├── docker-compose.yml      # PostgreSQL, Redis, NATS
│   ├── start.sh                # Start infrastructure
│   └── stop.sh                 # Stop infrastructure
└── docs/                       # Documentation
```

## Example Usage

```bash
# 1. Start infrastructure
pnpm infra:start

# 2. Run migrations
pnpm db:migrate

# 3. Start services (in separate terminals)
pnpm service:gateway        # Port 3000
pnpm service:auth           # Port 3001
pnpm service:scores         # Port 3002
pnpm service:leaderboards   # Port 3003
pnpm service:worker         # Port 3004
pnpm service:billing        # Port 3005

# 4. Create tenant & get API key
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com"}'

curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"tenantId": "<tenant-id>", "name": "My Game"}'

curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"projectId": "<project-id>", "name": "Production"}'

# 5. Use API through gateway
# Create leaderboard
curl -X POST http://localhost:3000/leaderboards \
  -H "X-Api-Key: ak_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Global Rankings", "sortOrder": "desc"}'

# Submit score
curl -X POST http://localhost:3000/scores \
  -H "X-Api-Key: ak_..." \
  -H "Content-Type: application/json" \
  -d '{"leaderboardId": "<id>", "playerId": "player123", "score": 1000}'

# Get rankings
curl http://localhost:3000/leaderboards/<id>/rankings?limit=10 \
  -H "X-Api-Key: ak_..."
```

## Development Progress

- [x] **Phase 0** - Foundation (PNPM workspaces, shared packages)
- [x] **Phase 1** - Auth Service (Tenants, projects, API keys)
- [x] **Phase 2** - API Gateway (Routing, auth validation)
- [x] **Phase 3** - Scores Service (Redis ZADD, rankings)
- [x] **Phase 4** - Leaderboards Service (CRUD, metadata)
- [x] **Phase 5** - Worker & Event Bus (NATS JetStream, async processing)
- [x] **Phase 6** - Billing Service (Usage tracking, plans, rate limiting)
- [ ] **Phase 7** - Analytics Service (Time-series metrics, dashboards)
- [ ] **Phase 8** - Admin Dashboard (Web UI for management)

See [Roadmap](./docs/roadmap.md) for detailed milestones.

## Production Deployment

### Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/ascend

# Redis
REDIS_URL=redis://host:6379

# NATS
NATS_URL=nats://host:4222

# Security
INTERNAL_API_SECRET=<secure-random-string>

# Gateway-specific
RATE_LIMIT_ENABLED=true
```

### Docker Example

```dockerfile
FROM node:25-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:25-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/gateway/dist/index.js"]
```

### Deployment Targets

- **Railway** - Easy deployment with automatic scaling
- **Fly.io** - Global edge deployment
- **AWS ECS** - Container orchestration with managed infrastructure
- **Kubernetes** - Self-managed cluster deployment

## Key Features & Highlights

### Performance

- **Sub-5ms latency** for score submissions and rank queries
- **Redis-backed leaderboards** with sorted sets (ZADD/ZRANK)
- **Token bucket rate limiting** with Redis Lua scripts

### Scalability

- **Horizontal scaling** - All services are stateless
- **Event-driven architecture** - NATS JetStream for async processing
- **Database per service** - Logical separation in PostgreSQL
- **Redis for hot paths** - Cache and leaderboard data

### Developer Experience

- **Type-safe** - Shared TypeScript types across services
- **Monorepo** - PNPM workspaces with shared packages
- **Auto-generated docs** - Swagger UI for all services
- **Local dev setup** - Docker Compose with one command

## License

ISC

---

Built using TypeScript and microservices architecture.
