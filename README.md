# Ascend - Leaderboard SaaS Platform

A production-ready, microservices-based leaderboard platform for games and applications.

## 🚀 Features

- **Multi-tenant Architecture** - Isolated data per tenant
- **API Key Management** - Secure authentication with rotation & revocation
- **High Performance** - Redis-backed leaderboards
- **Scalable Design** - Independent microservices
- **Type-Safe** - Full TypeScript implementation
- **Modern Stack** - Fastify, Postgres, Redis, Drizzle

## 📦 Project Structure

```
ascend/
├── apps/                    # Microservices
│   └── auth-service/        # ✅ Authentication & tenant management
├── packages/                # Shared libraries
│   ├── types/               # TypeScript interfaces
│   ├── db/                  # Database client & schema
│   ├── redis-client/        # Redis wrapper
│   ├── utils/               # API key hashing utilities
│   └── sdk-js/              # Client SDK
├── infra/                   # Infrastructure
│   └── docker-compose.yml   # PostgreSQL & Redis
└── docs/                    # Documentation
```

## 🏃 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
pnpm infra:start

# 3. Run database migrations
pnpm db:migrate

# 4. Start auth service
cd apps/auth-service
pnpm dev
```

**[📖 Full Getting Started Guide](./docs/getting-started.md)**

## 🛠️ Tech Stack

### Backend Services
- **[Fastify](https://fastify.dev/)** - High-performance web framework
- **[PostgreSQL](https://www.postgresql.org/)** - Primary database
- **[Redis](https://redis.io/)** - Leaderboard storage & caching
- **[Drizzle](https://orm.drizzle.team/)** - Schema management
- **[postgres.js](https://github.com/porsager/postgres)** - PostgreSQL client

### Development
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[pnpm](https://pnpm.io/)** - Fast package manager
- **[Docker](https://www.docker.com/)** - Local infrastructure
- **[ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)** - Code quality

## 📚 Documentation

- **[Getting Started](./docs/getting-started.md)** - Setup and first steps
- **[Database Architecture](./docs/database-architecture.md)** - How we use Drizzle & postgres.js
- **[Development Roadmap](./docs/roadmap.md)** - Project phases and progress
- **[Auth Service](./apps/auth-service/README.md)** - API documentation

## 🏗️ Available Services

| Service | Status | Port | Description |
|---------|--------|------|-------------|
| Auth Service | ✅ Live | 3001 | Tenant & API key management |
| API Gateway | 🔄 Next | 3000 | Request routing & validation |
| Scores Service | 📋 Planned | 3002 | Score updates & queries |
| Leaderboards Service | 📋 Planned | 3003 | Leaderboard CRUD |
| Worker Service | 📋 Planned | 3004 | Background jobs |
| Billing Service | 📋 Planned | 3005 | Usage tracking |
| Analytics Service | 📋 Planned | 3006 | Metrics & insights |

## 🧪 Example Usage

### Create API Key
```bash
# 1. Create tenant
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com"}'

# 2. Create project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "<id>", "name": "My Game"}'

# 3. Generate API key
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<id>", "name": "Production"}'
```

### Validate API Key
```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "ak_..."}'
```

## 📊 Development Progress

- [x] **Phase 0** - Foundation (PNPM workspaces, packages, CI)
- [x] **Phase 1** - Auth & Tenant System
- [ ] **Phase 2** - API Gateway
- [ ] **Phase 3** - Scores Service
- [ ] **Phase 4** - Leaderboards Service
- [ ] **Phase 5+** - Worker, Billing, Analytics, Dashboard

**[View Full Roadmap](./docs/roadmap.md)**

## 🔧 Common Commands

```bash
# Infrastructure
pnpm infra:start        # Start PostgreSQL & Redis
pnpm infra:stop         # Stop infrastructure
pnpm infra:logs         # View logs

# Database
pnpm db:generate        # Generate migration
pnpm db:migrate         # Run migrations
pnpm db:studio          # Open GUI

# Development
pnpm build              # Build all packages
pnpm dev                # Watch mode
pnpm lint               # Lint code
pnpm format             # Format code
```

## 🏛️ Architecture Decisions

### Database Layer
We use **Drizzle Kit for schema management** and **postgres.js for queries**:
- ✅ Type-safe schema definitions
- ✅ Clean SQL queries (no ORM overhead)
- ✅ Full SQL flexibility
- ✅ Better performance

**[Learn More](./docs/database-architecture.md)**

### Microservices
Each service is independent with its own:
- Database schema (shared Postgres)
- Business logic
- API endpoints
- Build & deploy pipeline

## 🤝 Contributing

This is a learning/portfolio project. Feel free to explore the code and architecture!

## 📝 License

ISC

---

Built with ❤️ using modern TypeScript and microservices architecture.
