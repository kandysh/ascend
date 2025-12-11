# Billing Service

Lean billing and usage tracking service for the Ascend platform.

## Features

- **Subscription Management** - Tenant subscription lifecycle (free, pro, enterprise)
- **Usage Tracking** - Record API usage for billing
- **Limit Enforcement** - Check against plan limits
- **Usage Reporting** - Daily, monthly aggregates

## Plans (Database Enums)

Three plan types are defined as PostgreSQL enums and seeded via migration:

- **free** - $0/month, 10K requests, 5 leaderboards, 2 API keys
- **pro** - $49/month, 1M requests, 50 leaderboards, 10 API keys
- **enterprise** - $499/month, 10M requests, 9999 leaderboards/keys

Plans are immutable and seeded automatically when running migrations:
```bash
pnpm db:migrate  # Plans are created automatically
```

## Database Tables

### plans (seeded via migration)
- type: `plan_type` enum (free, pro, enterprise)
- display_name, description
- price, currency
- requests_per_month, leaderboards_limit, api_keys_limit

### subscriptions
- tenant_id → tenants
- plan_id → plans
- status: `subscription_status` enum (active, cancelled, past_due)
- current_period_start/end

### usage_records
- Daily rollups per project
- score_updates, leaderboard_reads, total_requests

### invoices
- Invoice structure (for future payment integration)

## API Endpoints

### Subscriptions
- `POST /subscriptions` - Subscribe tenant to plan (by type: free/pro/enterprise)
- `GET /subscriptions/tenant/:tenantId` - Get tenant subscription
- `PATCH /subscriptions/:id/cancel` - Cancel subscription
- `GET /subscriptions/:id/usage-check` - Check plan limits

### Usage
- `POST /usage/record` - Record usage
- `GET /usage/tenant/:tenantId` - Get tenant usage
- `GET /usage/project/:projectId` - Get project usage
- `GET /usage/aggregate/tenant/:tenantId` - Monthly summary

## Running

```bash
pnpm service:billing  # Port 3005
```

## Example: Subscribe Tenant

```bash
curl -X POST http://localhost:3005/subscriptions \
  -H "X-Internal-Secret: dev-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-uuid",
    "planType": "pro"
  }'
```

## Integration

Gateway should:
1. Call `/subscriptions/:id/usage-check` to enforce limits
2. Call `/usage/record` to track requests
3. Return 429 when limits exceeded
