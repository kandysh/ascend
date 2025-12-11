# Local Development Infrastructure

This directory contains Docker Compose configurations for local development infrastructure.

## Services

### Core Services (Required)

- **PostgreSQL** (Port 5432) - Main database
- **Redis** (Port 6379) - Caching and leaderboard storage

### Optional GUI Tools

- **pgAdmin** (Port 5050) - PostgreSQL management
  - Email: `admin@ascend.local`
  - Password: `admin`
- **Redis Commander** (Port 8081) - Redis GUI

## Quick Start

### Start All Services

```bash
cd infra
docker compose up -d
```

### Start Only Core Services (no GUI tools)

```bash
docker compose up -d postgres redis
```

### Stop All Services

```bash
docker compose down
```

### Stop and Remove Volumes (Clean Start)

```bash
docker compose down -v
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f postgres
docker compose logs -f redis
```

### Check Service Status

```bash
docker compose ps
```

## Database Setup

After starting PostgreSQL, run migrations:

```bash
# From project root
pnpm db:migrate
```

## Connection Strings

### PostgreSQL

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ascend
```

### Redis

```
REDIS_URL=redis://localhost:6379
```

## GUI Access

### pgAdmin (PostgreSQL)

1. Open http://localhost:5050
2. Login with:
   - Email: `admin@ascend.local`
   - Password: `admin`
3. Add server:
   - Host: `postgres` (or `host.docker.internal` on Mac/Windows)
   - Port: `5432`
   - Username: `postgres`
   - Password: `postgres`
   - Database: `ascend`

### Redis Commander

1. Open http://localhost:8081
2. No login required
3. Browse keys, view data, run commands

## Data Persistence

All data is persisted in Docker volumes:

- `postgres_data` - PostgreSQL database files
- `redis_data` - Redis AOF persistence
- `pgadmin_data` - pgAdmin configuration

## Troubleshooting

### Port Already in Use

If ports 5432 or 6379 are already in use, modify the ports in `docker-compose.yml`:

```yaml
ports:
  - '15432:5432' # Use different host port
```

Then update your `.env`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:15432/ascend
```

### Reset Everything

```bash
docker compose down -v
docker compose up -d
pnpm db:migrate
```

### Connection Refused

Make sure services are healthy:

```bash
docker compose ps
```

Wait for health checks to pass (healthy status).
