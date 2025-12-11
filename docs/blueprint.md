/apps
  /api          → Fastify backend
  /dashboard    → Next.js frontend
  /collector    → OTEL collector config

/packages
  /db           → drizzle or prisma or sql helpers
  /redis        → redis client wrapper
  /types        → shared TypeScript types
  /utils        → rate limiting, API key hashing
  /sdk-js       → client SDK

/infra
  docker-compose.yml
  grafana/

/docs
  architecture.md
  blueprint.md
