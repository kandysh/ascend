# Ascend 🚀

**Ultra-fast, production-grade leaderboard SaaS platform** built for scale and simplicity.

## Overview

Ascend is a modern, multi-tenant leaderboard API platform with sub-10ms latency, real-time rankings powered by Redis, and enterprise-grade observability. Perfect for gaming, competitions, or any application requiring high-performance ranking systems.

### Key Features

- ⚡ **Sub-10ms Latency** - Redis-powered real-time rankings
- 🏢 **Multi-Tenant** - Secure API key-based tenant isolation
- 📊 **Full Observability** - OpenTelemetry + Grafana stack
- 🔥 **Production Ready** - Rate limiting, logging, and monitoring built-in
- 💰 **Cost-Effective** - Minimal infrastructure requirements
- 📈 **Horizontally Scalable** - Ready to grow with your needs

## Architecture

This monorepo uses [Turborepo](https://turborepo.com/) and includes:

### Apps

- `api` - Express.js API server with Redis leaderboard engine
- `dashboard` - Next.js admin dashboard
- `collector` - OpenTelemetry collector setup

### Packages

- `@repo/types` - Shared TypeScript types
- `@repo/sdk-js` - JavaScript SDK for API integration
- `@repo/eslint-config` - Shared ESLint configuration

### Tech Stack

- **Backend**: Express.js, Redis (ZSET), PostgreSQL
- **Frontend**: Next.js, Tailwind CSS, shadcn/ui
- **Observability**: OpenTelemetry, Prometheus, Loki, Tempo, Grafana
- **Tools**: ESLint, Prettier, Turborepo

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9.0.0
- Redis
- PostgreSQL

### Installation

```bash
# Clone the repository
git clone https://github.com/kandysh/ascend.git
cd ascend

# Install dependencies
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm dev --filter=api
pnpm dev --filter=dashboard
```

### Build

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm build --filter=api
```

### Other Commands

```bash
# Lint code
pnpm lint

# Format code
pnpm format
```

## API Endpoints

```
POST   /v1/scores/update           - Update player score
GET    /v1/leaderboards/:id/top    - Get top players
GET    /v1/leaderboards/:id/rank/:user  - Get user rank
POST   /v1/leaderboards            - Create leaderboard
DELETE /v1/leaderboards/:id        - Delete leaderboard
GET    /v1/usage                   - Get usage statistics
```

## Documentation

- [Architecture Overview](./architecture.md) - System design and component details
- [Blueprint](./blueprint.md) - Implementation specifications

## Performance

- **Target Latency**: <10ms
- **Hot Path**: Redis-only operations
- **Scalability**: Horizontal scaling with Redis cluster
- **Rate Limits**: 30-300 req/s depending on plan

## Deployment

Recommended deployment options:

- **API**: Fly.io, Railway, or Render
- **Redis**: Upstash or Aiven
- **PostgreSQL**: Neon or Supabase
- **Observability**: Docker Compose on small VM

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines first.
