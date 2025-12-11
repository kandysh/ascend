# Testing the API Gateway

This guide walks through testing the complete authentication and routing flow.

## Prerequisites

1. Infrastructure running:

   ```bash
   pnpm infra:start
   ```

2. Auth service running:

   ```bash
   # From project root
   pnpm service:auth
   ```

3. Gateway running:
   ```bash
   # From project root (in a new terminal)
   pnpm service:gateway
   ```

## Step 1: Create Test Tenant & API Key

### Create Tenant

```bash
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Corp", "email": "test@example.com"}'
```

Save the `tenant.id` from the response.

### Create Project

```bash
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<TENANT_ID>",
    "name": "Test Game"
  }'
```

Save the `project.id` from the response.

### Create API Key

```bash
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<PROJECT_ID>",
    "name": "Test Key"
  }'
```

Save the `apiKey` (starts with `ak_...`) from the response. **This is only shown once!**

## Step 2: Test Gateway Authentication

### Test Without API Key (Should Fail)

```bash
curl -v http://localhost:3000/health
# ✅ Should return 200 OK (health check is public)

curl -v http://localhost:3000/leaderboards/test
# ❌ Should return 401 Unauthorized - X-Api-Key header is required
```

### Test With Invalid API Key (Should Fail)

```bash
curl -v http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: invalid_key_123"
# ❌ Should return 401 Unauthorized - Invalid or revoked API key
```

### Test With Valid API Key (Should Work)

```bash
curl -v http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: <YOUR_API_KEY>"
# ⚠️  Should return 502 Bad Gateway (leaderboards service not running yet)
# But this means authentication worked!
```

Check the gateway logs - you should see:

```
"Request authenticated"
tenantId: "..."
projectId: "..."
```

## Step 3: Test Rate Limiting

Run this script to test rate limiting (1000 req/min limit):

```bash
#!/bin/bash
API_KEY="<YOUR_API_KEY>"

echo "Sending 1010 requests to test rate limiting..."

for i in {1..1010}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    http://localhost:3000/leaderboards/test \
    -H "X-Api-Key: $API_KEY")

  if [ "$STATUS" = "429" ]; then
    echo "Request $i: Rate limited! (429)"
    break
  elif [ "$i" -eq "1010" ]; then
    echo "Request $i: $STATUS"
  elif [ $(($i % 100)) -eq 0 ]; then
    echo "Request $i: $STATUS"
  fi
done
```

Expected output:

```
Request 100: 502
Request 200: 502
...
Request 1000: 502
Request 1001: Rate limited! (429)
```

## Step 4: Test Usage Tracking

Make a few successful requests (even if downstream service fails):

```bash
# Make 5 requests
for i in {1..5}; do
  curl -s http://localhost:3000/leaderboards/test \
    -H "X-Api-Key: <YOUR_API_KEY>" > /dev/null
  echo "Request $i sent"
done
```

Check the gateway logs for usage tracking:

```json
{
  "tenantId": "...",
  "projectId": "...",
  "path": "/leaderboards/test",
  "method": "GET",
  "statusCode": 502,
  "dailyUsage": 5,
  "msg": "Request tracked"
}
```

## Step 5: Test API Key Revocation

### Revoke the API Key

```bash
curl -X DELETE http://localhost:3001/api-keys/<API_KEY_ID>
```

### Try Using Revoked Key

```bash
curl -v http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: <YOUR_API_KEY>"
# ❌ Should return 401 Unauthorized - Invalid or revoked API key
```

## Step 6: Test Multiple Tenants

Create a second tenant with its own API key and verify:

1. Each tenant has separate rate limits
2. Usage tracking is per-tenant
3. Tenant context is correctly injected

```bash
# Create second tenant
curl -X POST http://localhost:3001/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Corp 2", "email": "corp2@example.com"}'

# Create project for tenant 2
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "<TENANT_2_ID>", "name": "Game 2"}'

# Create API key for tenant 2
curl -X POST http://localhost:3001/api-keys \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<PROJECT_2_ID>", "name": "Key 2"}'

# Test both API keys work independently
curl http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: <API_KEY_1>"

curl http://localhost:3000/leaderboards/test \
  -H "X-Api-Key: <API_KEY_2>"
```

## Expected Responses

### 200 OK - Health Check

```json
{
  "status": "ok",
  "service": "gateway"
}
```

### 401 Unauthorized - Missing API Key

```json
{
  "error": "Unauthorized",
  "message": "X-Api-Key header is required"
}
```

### 401 Unauthorized - Invalid API Key

```json
{
  "error": "Unauthorized",
  "message": "Invalid or revoked API key"
}
```

### 429 Too Many Requests

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 1 minute"
}
```

### 502 Bad Gateway - Service Down

```json
{
  "statusCode": 502,
  "error": "Bad Gateway",
  "message": "Service temporarily unavailable"
}
```

### 503 Service Unavailable - Auth Service Down

```json
{
  "error": "Service Unavailable",
  "message": "Auth service is unavailable"
}
```

## Troubleshooting

### Gateway won't start

```bash
# Check if port 3000 is already in use
lsof -i :3000

# Check if AUTH_SERVICE_URL is configured
cat .env | grep AUTH_SERVICE_URL
```

### Authentication always fails

```bash
# Check if auth service is running
curl http://localhost:3001/health

# Test API key validation directly
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "<YOUR_API_KEY>"}'
```

### Rate limiting not working

Check that requests are using the same API key (same tenant).
Different API keys = different tenants = separate rate limits.

## Production Checklist

Before deploying to production:

- [ ] Replace in-memory usage tracking with Redis
- [ ] Add distributed rate limiting (Redis-backed)
- [ ] Configure proper rate limits per plan
- [ ] Add request/response logging
- [ ] Set up monitoring and alerts
- [ ] Configure circuit breakers
- [ ] Add request retry logic
- [ ] Set up distributed tracing
- [ ] Configure CORS properly
- [ ] Add request size limits
