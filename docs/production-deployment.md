# Production Deployment Guide

## Environment Variables

### Development

- Uses `.env` file in project root
- Loaded automatically by services
- Never committed to git

### Production

- Environment variables set directly in the deployment platform
- No `.env` file needed
- Services detect `NODE_ENV=production` and skip file loading

## How It Works

All services check `NODE_ENV` before loading `.env`:

```typescript
// Load .env file only in development
if (process.env.NODE_ENV !== 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  config({ path: resolve(__dirname, '../../../.env') });
}
```

**In Development:**

- `NODE_ENV` is not set (or set to `development`)
- Services load `.env` file
- Local development works seamlessly

**In Production:**

- `NODE_ENV=production`
- Services skip `.env` loading
- Use platform environment variables

## Deployment Platforms

### Docker

**Dockerfile Example:**

```dockerfile
FROM node:25-alpine

WORKDIR /app

# Copy source
COPY . .

# Install dependencies
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm run build

# Set production env
ENV NODE_ENV=production

# Start service
CMD ["node", "apps/auth-service/dist/index.js"]
```

**docker-compose.yml:**

```yaml
services:
  auth-service:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://user:pass@db:5432/ascend
      PORT: 3001
    ports:
      - '3001:3001'
```

### Kubernetes

**Deployment with ConfigMap:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ascend-config
data:
  NODE_ENV: 'production'
  DATABASE_URL: 'postgres://user:pass@db:5432/ascend'
  AUTH_SERVICE_URL: 'http://auth-service:3001'
  REDIS_URL: 'redis://redis:6379'
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    spec:
      containers:
        - name: auth-service
          image: ascend/auth-service:latest
          envFrom:
            - configMapRef:
                name: ascend-config
          env:
            - name: PORT
              value: '3001'
```

**With Secrets (Recommended):**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ascend-secrets
type: Opaque
stringData:
  DATABASE_URL: 'postgres://user:pass@db:5432/ascend'
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  template:
    spec:
      containers:
        - name: auth-service
          image: ascend/auth-service:latest
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ascend-secrets
                  key: DATABASE_URL
```

### Railway / Render / Fly.io

Set environment variables in the dashboard:

```
NODE_ENV=production
DATABASE_URL=postgres://...
REDIS_URL=redis://...
AUTH_SERVICE_URL=https://auth.yourdomain.com
PORT=3001
```

### AWS (ECS/Fargate)

**Task Definition:**

```json
{
  "containerDefinitions": [
    {
      "name": "auth-service",
      "image": "ascend/auth-service:latest",
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3001" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-url"
        }
      ]
    }
  ]
}
```

### Vercel / Netlify (Edge Functions)

Set in project settings:

```bash
NODE_ENV=production
DATABASE_URL=postgres://...
```

## Build Scripts

Add production build scripts to `package.json`:

```json
{
  "scripts": {
    "build": "pnpm run --filter './packages/*' build",
    "build:services": "pnpm run --filter './apps/*' build",
    "start:auth": "NODE_ENV=production node apps/auth-service/dist/index.js",
    "start:gateway": "NODE_ENV=production node apps/gateway/dist/index.js"
  }
}
```

## Database Migrations

### Development

```bash
pnpm db:migrate
# Loads .env automatically
```

### Production

```bash
# Set env vars first
export NODE_ENV=production
export DATABASE_URL="postgres://..."

pnpm db:migrate
# Skips .env, uses environment variables
```

### In CI/CD (GitHub Actions)

```yaml
- name: Run Migrations
  env:
    NODE_ENV: production
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: pnpm db:migrate
```

## Environment Variables Checklist

### Required for All Services

- ✅ `NODE_ENV=production`
- ✅ `DATABASE_URL` - Postgres connection string
- ✅ `REDIS_URL` - Redis connection string

### Auth Service

- ✅ `PORT` (default: 3001)

### Gateway

- ✅ `PORT` (default: 3000)
- ✅ `AUTH_SERVICE_URL` - Internal auth service URL
- ✅ `SCORES_SERVICE_URL` - Internal scores service URL
- ✅ `LEADERBOARDS_SERVICE_URL` - Internal leaderboards service URL
- ✅ `BILLING_SERVICE_URL` - Internal billing service URL

## Security Best Practices

### ✅ DO:

- Use secrets management (AWS Secrets Manager, Vault, etc.)
- Rotate credentials regularly
- Use least-privilege database users
- Enable SSL for database connections
- Use environment-specific credentials
- Log to stdout/stderr (12-factor app)

### ❌ DON'T:

- Commit `.env` to git
- Use same credentials across environments
- Hardcode secrets in Dockerfiles
- Use root database users in production
- Expose internal service URLs publicly

## Health Checks

All services expose `/health` endpoint:

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"auth-service"}
```

Configure your orchestrator:

```yaml
# Kubernetes
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Monitoring

### Logs

Services use structured JSON logging (Fastify):

```json
{
  "level": 30,
  "time": 1702345678901,
  "pid": 123,
  "hostname": "auth-service-xyz",
  "msg": "Server listening at http://0.0.0.0:3001"
}
```

### Metrics

Consider adding:

- Prometheus metrics endpoint
- Request duration histograms
- Error rate counters
- Active connections gauge

## Rollback Strategy

1. **Blue-Green Deployment**
   - Run old and new versions simultaneously
   - Switch traffic after validation
   - Keep old version for quick rollback

2. **Database Migrations**
   - Always backward compatible
   - Run migrations before deploying code
   - Never drop columns/tables in same release

3. **Feature Flags**
   - Toggle new features without redeployment
   - Gradual rollout
   - Quick disable if issues found

## Troubleshooting Production

### Service Won't Start

```bash
# Check env vars are set
env | grep DATABASE_URL
env | grep NODE_ENV

# Check logs
docker logs <container-id>
kubectl logs <pod-name>
```

### Can't Connect to Database

```bash
# Test connection
psql $DATABASE_URL

# Check SSL requirement
# Add ?sslmode=require to connection string if needed
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
```

### Services Can't Find Each Other

- Use internal DNS names in Kubernetes
- Use service discovery
- Check network policies
- Verify service mesh configuration
