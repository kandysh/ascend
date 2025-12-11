# Ascend - Leaderboard SaaS Platform

A production-ready, microservices-based leaderboard platform for games and applications.

## 🚀 Quick Start

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

## 📦 Features

- **Multi-tenant Architecture** - Isolated data per tenant
- **API Key Management** - Secure authentication with rotation & revocation
- **API Gateway** - Request routing, rate limiting, and validation
- **Internal Service Security** - Services only accessible through gateway
- **Type-Safe** - Full TypeScript implementation
- **Modern Stack** - Fastify, Postgres, Redis, Drizzle

## 🛠️ Tech Stack

- **Runtime**: Node.js 25 + TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL (postgres.js + Drizzle Kit)
- **Cache**: Redis
- **Monorepo**: PNPM Workspaces

## 🏗️ Architecture

### Services

| Service                  | Port | Status     | Description                               |
| ------------------------ | ---- | ---------- | ----------------------------------------- |
| **Gateway**              | 3000 | ✅ Live    | Entry point, auth, routing, rate limiting |
| **Auth Service**         | 3001 | ✅ Live    | Tenants, projects, API keys               |
| **Scores Service**       | 3002 | 📋 Planned | Score updates and queries                 |
| **Leaderboards Service** | 3003 | 📋 Planned | Leaderboard CRUD and rankings             |
| **Worker Service**       | 3004 | 📋 Planned | Background jobs                           |
| **Billing Service**      | 3005 | 📋 Planned | Usage tracking                            |
| **Analytics Service**    | 3006 | 📋 Planned | Metrics and insights                      |

### Request Flow

```
Client → Gateway → Auth Service (validate)
           ↓
       Rate Limiting
           ↓
       Route to Service
```

## 📚 Documentation

- **[Blueprint](./docs/blueprint.md)** - High-level system design
- **[Architecture](./docs/high-level-design.md)** - Detailed architecture
- **[Roadmap](./docs/roadmap.md)** - Development phases and progress

## 🔧 Development Commands

```bash
# Infrastructure
pnpm infra:start       # Start PostgreSQL & Redis
pnpm infra:stop        # Stop infrastructure
pnpm infra:logs        # View logs
pnpm infra:clean       # Remove all data

# Database
pnpm db:generate       # Generate migration
pnpm db:migrate        # Run migrations
pnpm db:studio         # Open Drizzle Studio (GUI)

# Services
pnpm service:auth      # Start auth service
pnpm service:gateway   # Start gateway

# Development
pnpm build             # Build all packages
pnpm lint              # Lint code
pnpm format            # Format code
pnpm format:check      # Check formatting (CI)
```

## 🔒 Security

### Internal Service Authentication

Services require `X-Internal-Secret` header and can only be accessed through the gateway:

```env
INTERNAL_API_SECRET=your-secure-random-string
```

### API Key Format

API keys use bcrypt hashing and follow format: `ak_<base64url>`

## 🗂️ Project Structure

```
ascend/
├── apps/                    # Microservices
│   ├── auth-service/        # ✅ Authentication & tenant management
│   └── gateway/             # ✅ API Gateway
├── packages/                # Shared libraries
│   ├── db/                  # Database client & schema
│   ├── types/               # TypeScript interfaces
│   ├── utils/               # Shared utilities
│   ├── redis-client/        # Redis wrapper
│   └── sdk-js/              # Client SDK
├── infra/                   # Infrastructure
│   └── docker-compose.yml   # PostgreSQL & Redis
└── docs/                    # Documentation
```

## 🧪 Example Usage

```bash
# 1. Create tenant
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"name": "Acme Corp", "email": "admin@acme.com"}'

# 2. Create project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"tenantId": "<tenant-id>", "name": "My Game"}'

# 3. Generate API key
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: dev-secret-change-in-production" \
  -d '{"projectId": "<project-id>", "name": "Production"}'

# 4. Use API key through gateway
curl http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: ak_..."
```

## 📊 Development Progress

- [x] **Phase 0** - Foundation (PNPM workspaces, packages)
- [x] **Phase 1** - Auth & Tenant System
- [x] **Phase 2** - API Gateway
- [ ] **Phase 3** - Scores Service
- [ ] **Phase 4** - Leaderboards Service
- [ ] **Phase 5+** - Worker, Billing, Analytics, Dashboard

See [Roadmap](./docs/roadmap.md) for details.

## 🚀 Production Deployment

### Environment Variables

```bash
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host:5432/db
REDIS_URL=redis://host:6379
INTERNAL_API_SECRET=<secure-random-string>
```

### Docker Example

```dockerfile
FROM node:25-alpine
WORKDIR /app
COPY . .
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm run build
ENV NODE_ENV=production
CMD ["node", "apps/auth-service/dist/index.js"]
```

## 🤝 Contributing

This is a learning/portfolio project demonstrating modern microservices architecture.

## 📝 License

ISC

---

Built with ❤️ using TypeScript and microservices architecture.
