# API Gateway

The API Gateway is the entry point for all client requests. It handles authentication, rate limiting, usage tracking, and routing to downstream services.

## Features

- **API Key Authentication** - Validates X-Api-Key header with Auth Service
- **Tenant Context Injection** - Adds X-Tenant-Id and X-Project-Id headers
- **Rate Limiting** - Per-tenant rate limiting (1000 req/min)
- **Usage Tracking** - Tracks daily request counts per tenant
- **Request Routing** - Proxies to downstream microservices
- **Health Checks** - `/health` endpoint for monitoring

## Architecture

```
Client Request → Gateway → Auth Service (validate)
                    ↓
              Inject Tenant Context
                    ↓
              Rate Limiting Check
                    ↓
              Proxy to Service
                    ↓
              Track Usage
```

## Routes

### Public Routes
- `GET /health` - Health check (no auth required)

### Proxied Routes (require authentication)
- `/scores/*` → Scores Service (port 3002)
- `/leaderboards/*` → Leaderboards Service (port 3003)
- `/billing/*` → Billing Service (port 3005)

## Authentication Flow

1. Client sends request with `X-Api-Key` header
2. Gateway validates key with Auth Service
3. Auth Service returns tenant/project context
4. Gateway injects context into request headers
5. Request forwarded to downstream service

## Request Headers

### Required (from client)
```
X-Api-Key: ak_...
```

### Injected (by gateway)
```
X-Tenant-Id: <uuid>
X-Project-Id: <uuid>
```

Downstream services can trust these headers as they're validated by the gateway.

## Rate Limiting

- **Limit**: 1000 requests per minute per tenant
- **Strategy**: Token bucket algorithm
- **Response**: HTTP 429 when limit exceeded

## Usage Tracking

Tracks request counts per tenant per day:
```typescript
{
  "tenant-id:2024-12-11": 1542,
  "tenant-id:2024-12-10": 3201
}
```

In production, this should be:
- Stored in Redis
- Sent to a queue for processing
- Used for billing calculations

## Environment Variables

```env
PORT=3000
AUTH_SERVICE_URL=http://localhost:3001
SCORES_SERVICE_URL=http://localhost:3002
LEADERBOARDS_SERVICE_URL=http://localhost:3003
BILLING_SERVICE_URL=http://localhost:3005
```

## Development

```bash
# Start from project root (recommended)
pnpm service:auth

# Or from service directory
cd apps/auth-service
pnpm dev

# Build
pnpm run build

# Production
pnpm start
```

## Example Usage

### Authenticated Request
```bash
# Get leaderboard top scores
curl http://localhost:3000/leaderboards/my-game/top \
  -H "X-Api-Key: ak_..."

# Update score
curl -X POST http://localhost:3000/scores/update \
  -H "X-Api-Key: ak_..." \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "leaderboardId": "my-game",
    "score": 1000
  }'
```

### Unauthenticated Request
```bash
curl http://localhost:3000/leaderboards/top
# 401 Unauthorized - X-Api-Key header is required
```

### Invalid API Key
```bash
curl http://localhost:3000/leaderboards/top \
  -H "X-Api-Key: invalid_key"
# 401 Unauthorized - Invalid or revoked API key
```

### Rate Limit Exceeded
```bash
# After 1000 requests in 1 minute
curl http://localhost:3000/leaderboards/top \
  -H "X-Api-Key: ak_..."
# 429 Too Many Requests
```

## Middleware Order

1. **CORS** - Handle cross-origin requests
2. **Auth** - Validate API key and inject context
3. **Rate Limit** - Check tenant rate limits
4. **Proxy** - Forward to downstream service
5. **Usage** - Track request for billing

## Error Handling

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Unauthorized | Missing or invalid API key |
| 429 | Too Many Requests | Rate limit exceeded |
| 503 | Service Unavailable | Auth service down |
| 502 | Bad Gateway | Downstream service error |

## Monitoring

Key metrics to track:
- Request rate per tenant
- Auth validation latency
- Proxy latency
- Error rates (4xx, 5xx)
- Rate limit hits

## Future Improvements

- [ ] Redis-backed rate limiting
- [ ] Circuit breaker for downstream services
- [ ] Request retry with exponential backoff
- [ ] Distributed tracing (OpenTelemetry)
- [ ] API versioning support
- [ ] GraphQL gateway support
- [ ] WebSocket proxying
