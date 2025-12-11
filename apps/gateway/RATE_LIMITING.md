# Redis Token Bucket Rate Limiter

Distributed rate limiting using the **Token Bucket algorithm** implemented with Redis and Lua scripting.

## How It Works

### Token Bucket Algorithm

1. **Bucket Initialization**: Each tenant gets a bucket with a maximum capacity of tokens
2. **Token Refill**: Tokens are added to the bucket at a constant rate (per second)
3. **Token Consumption**: Each request consumes tokens from the bucket
4. **Rate Limit**: If not enough tokens available, request is rejected with 429

### Why Token Bucket?

- ✅ **Allows Bursts**: Users can burst up to bucket capacity
- ✅ **Smooth Traffic**: Refills at constant rate for sustained load
- ✅ **Fair Distribution**: Each tenant has isolated bucket
- ✅ **Distributed**: Redis ensures consistency across gateway instances

## Plan-Based Limits

| Plan       | Capacity (Burst) | Refill Rate   | Max Sustained RPS | Daily Limit |
|------------|------------------|---------------|-------------------|-------------|
| Free       | 10 requests      | 1 token/sec   | 1 req/sec         | ~86K        |
| Pro        | 100 requests     | 50 tokens/sec | 50 req/sec        | ~4.3M       |
| Enterprise | 500 requests     | 200 tokens/sec| 200 req/sec       | ~17M        |

### Example Scenarios

**Free Plan (Burst = 10, Refill = 1/sec):**
- User makes 10 requests instantly → ✅ All pass (burst allowed)
- User makes 11th request instantly → ❌ Rate limited
- User waits 5 seconds → 5 tokens refilled
- User makes 5 more requests → ✅ All pass

**Pro Plan (Burst = 100, Refill = 50/sec):**
- User can sustain 50 req/sec indefinitely
- Can burst to 100 requests when needed
- Bucket refills quickly (2 seconds to full)

## Implementation Details

### Redis Lua Script

The rate limiter uses an **atomic Lua script** to ensure consistency:

```lua
-- Get current bucket state
local tokens = redis.call('HGET', key, 'tokens') or capacity
local last_refill = redis.call('HGET', key, 'last_refill') or now

-- Calculate tokens to add based on time elapsed
local time_elapsed = (now - last_refill) / 1000
local tokens_to_add = time_elapsed * refill_rate
tokens = min(capacity, tokens + tokens_to_add)

-- Check if we have enough tokens
if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
  return {1, tokens, capacity} -- Allowed
else
  return {0, tokens, capacity} -- Denied
end
```

### Redis Keys

- **Format**: `rate_limit:{tenantId}`
- **Data Structure**: Hash with `tokens` and `last_refill` fields
- **TTL**: 60 seconds after last request (auto-cleanup)

### Response Headers

All requests include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1702318920
```

When rate limited (429):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 5
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1702318925

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please retry after 5 seconds.",
  "limit": 100,
  "remaining": 0,
  "resetAt": "2025-12-11T16:15:25.000Z"
}
```

## Flow in Gateway

```
Request → Auth Middleware → Rate Limit Middleware → Proxy to Service
                ↓                    ↓
         Sets tenantId           Checks bucket
         Sets planType           Consumes tokens
```

1. **Auth Middleware**: Validates API key, sets `tenantId` and `planType`
2. **Rate Limit Middleware**: Checks Redis bucket, allows/denies request
3. **Proxy**: Forwards request to downstream service

## Configuration

Located in `apps/gateway/src/middleware/rate-limit.ts`:

```typescript
const PLAN_RATE_LIMITS: Record<string, TokenBucketConfig> = {
  free: {
    capacity: 10,      // Burst size
    refillRate: 1,     // Tokens per second
  },
  pro: {
    capacity: 100,
    refillRate: 50,
  },
  enterprise: {
    capacity: 500,
    refillRate: 200,
  },
};
```

## Failure Modes

### Redis Down

**Current Behavior**: Fail open (allow requests)
- Logs error but doesn't block traffic
- Graceful degradation

**Alternative**: Fail closed (deny requests)
```typescript
if (error) {
  return reply.code(503).send({ error: 'Service unavailable' });
}
```

### Clock Skew

- Uses `Date.now()` for timestamps
- Redis atomic operations prevent race conditions
- Time-based calculations handle minor skew gracefully

## Testing

### Local Testing

```bash
# Start Redis
docker compose up -d redis

# Start Gateway
pnpm service:gateway

# Test rate limiting
for i in {1..15}; do
  curl -H "X-Api-Key: your-key" http://localhost:3000/scores/submit
  echo "Request $i"
done
```

### Expected Results (Free Plan)

- Requests 1-10: ✅ 200 OK (burst allowed)
- Request 11: ❌ 429 Too Many Requests
- Wait 5 seconds
- Requests 12-16: ✅ 200 OK (5 tokens refilled)

## Monitoring

### Redis Keys to Monitor

```bash
# View tenant bucket
redis-cli HGETALL rate_limit:tenant-uuid

# View all rate limit keys
redis-cli KEYS rate_limit:*

# Monitor commands
redis-cli MONITOR | grep rate_limit
```

### Metrics to Track

- Rate limit hits (429 responses) per tenant
- Average bucket token levels
- Redis operation latency
- Failed open rate (Redis errors)

## Advantages Over @fastify/rate-limit

| Feature | @fastify/rate-limit | Redis Token Bucket |
|---------|-------------------|-------------------|
| **Distribution** | Single instance | Multi-instance |
| **Algorithm** | Fixed window | Token bucket |
| **Burst Handling** | ❌ No | ✅ Yes |
| **Plan-Based** | Manual config | Automatic |
| **Fairness** | Window reset spike | Smooth refill |
| **State** | In-memory | Persistent Redis |

## Future Improvements

- [ ] Add per-endpoint rate limits (e.g., writes vs reads)
- [ ] Implement rate limit analytics dashboard
- [ ] Add Redis cluster support for HA
- [ ] Implement adaptive rate limiting based on load
- [ ] Add webhook notifications for rate limit events
- [ ] Cache plan limits in Redis for faster lookups

## References

- [Token Bucket Algorithm - Wikipedia](https://en.wikipedia.org/wiki/Token_bucket)
- [Rate Limiting with Redis - Redis Labs](https://redislabs.com/redis-best-practices/basic-rate-limiting/)
- [Generic Cell Rate Algorithm (GCRA)](https://en.wikipedia.org/wiki/Generic_cell_rate_algorithm)
