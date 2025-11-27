# Ascend Leaderboard API

Ultra-fast, production-grade leaderboard API with sub-10ms latency powered by Redis ZSET operations.

## Features

- ⚡ **Sub-10ms Latency** - Redis-powered real-time rankings
- 🏢 **Multi-Tenant** - Secure API key-based tenant isolation
- 📊 **Full Observability** - OpenTelemetry + Prometheus metrics
- 🛡️ **Rate Limiting** - Redis-based sliding window rate limiter
- 📈 **Usage Tracking** - Per-tenant operation tracking and limits

## Quick Start

### Prerequisites

- Node.js 22+
- Redis 6+
- PostgreSQL 14+

### Installation

```bash
# From the monorepo root
pnpm install

# Or from the api directory
cd apps/api
pnpm install
```

### Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/ascend` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `LOG_LEVEL` | Pino log level | `info` |

### Database Setup

Run migrations to create the database schema:

```bash
pnpm db:migrate

# With sample seed data
pnpm db:migrate -- --seed
```

### Running the Server

```bash
# Development mode (with auto-reload)
pnpm dev

# Production mode
pnpm start
```

## API Endpoints

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Basic health check |
| `GET /health/ready` | Readiness probe (checks Redis & PostgreSQL) |
| `GET /health/live` | Liveness probe |
| `GET /health/detailed` | Detailed health with latency metrics |

### Leaderboard Management

| Endpoint | Description |
|----------|-------------|
| `POST /v1/leaderboards` | Create a new leaderboard |
| `GET /v1/leaderboards` | List all leaderboards |
| `GET /v1/leaderboards/:id` | Get leaderboard details |
| `DELETE /v1/leaderboards/:id` | Delete a leaderboard |

### Scores & Rankings

| Endpoint | Description |
|----------|-------------|
| `POST /v1/scores/update` | Update a user's score |
| `POST /v1/scores/batch` | Batch update multiple scores |
| `DELETE /v1/scores/:leaderboardId/:userId` | Remove a user's score |
| `GET /v1/leaderboards/:id/top` | Get top entries |
| `GET /v1/leaderboards/:id/rank/:userId` | Get user's rank |
| `POST /v1/leaderboards/:id/ranks` | Get multiple users' ranks |
| `GET /v1/leaderboards/:id/around/:userId` | Get entries around a user |

### Usage & Analytics

| Endpoint | Description |
|----------|-------------|
| `GET /v1/usage` | Get current month's usage |
| `GET /v1/usage/history` | Get usage history |
| `GET /v1/usage/daily` | Get daily usage breakdown |
| `GET /v1/usage/breakdown` | Get usage by leaderboard |

## Authentication

All `/v1/*` endpoints require an API key passed in the `X-Api-Key` header:

```bash
curl -H "X-Api-Key: your_api_key_here" \
  http://localhost:3000/v1/leaderboards
```

## Usage Examples

### Create a Leaderboard

```bash
curl -X POST http://localhost:3000/v1/leaderboards \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_api_key" \
  -d '{
    "name": "global",
    "description": "Global high scores",
    "sortOrder": "desc"
  }'
```

### Update a Score

```bash
# Set absolute score
curl -X POST http://localhost:3000/v1/scores/update \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_api_key" \
  -d '{
    "leaderboardId": "global",
    "userId": "player123",
    "score": 1500,
    "mode": "set"
  }'

# Increment score
curl -X POST http://localhost:3000/v1/scores/update \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: your_api_key" \
  -d '{
    "leaderboardId": "global",
    "userId": "player123",
    "delta": 100,
    "mode": "increment"
  }'
```

### Get Top Scores

```bash
curl -H "X-Api-Key: your_api_key" \
  "http://localhost:3000/v1/leaderboards/global/top?limit=10"
```

### Get User Rank

```bash
curl -H "X-Api-Key: your_api_key" \
  http://localhost:3000/v1/leaderboards/global/rank/player123
```

## Rate Limits

Rate limits are applied per tenant based on their plan:

| Plan | Requests/Second | Operations/Month |
|------|-----------------|------------------|
| Free | 30 | 100,000 |
| Hobby | 100 | 2,000,000 |
| Pro | 300 | 20,000,000 |
| Enterprise | 1,000 | Unlimited |

Rate limit headers are included in all responses:

- `X-RateLimit-Limit` - Maximum requests per second
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Unix timestamp when the window resets

## Observability

### Metrics

Prometheus metrics are exposed on port `9464` when OpenTelemetry is enabled:

```bash
curl http://localhost:9464/metrics
```

### Logging

Structured JSON logs using Pino with automatic trace ID correlation.

### Tracing

OpenTelemetry traces are exported to the configured collector endpoint.

Enable OpenTelemetry in production:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Project Structure

```
apps/api/
├── src/
│   ├── config/          # Environment configuration
│   ├── db/              # Database clients (Redis, PostgreSQL)
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # API key authentication
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── routes/          # Route handlers
│   │   ├── health.js
│   │   └── v1/
│   │       ├── leaderboards.js
│   │       ├── scores.js
│   │       └── usage.js
│   ├── services/        # Business logic
│   │   ├── leaderboard.js
│   │   └── usage.js
│   ├── utils/           # Utilities
│   │   ├── logger.js
│   │   └── otel.js
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── .env.example
├── package.json
└── README.md
```

## Development

```bash
# Run in development mode with auto-reload
pnpm dev

# Run linter
pnpm lint

# Run database migrations
pnpm db:migrate

# Seed database with sample data
pnpm db:migrate -- --seed
```

## License

MIT