#!/bin/bash
set -e

echo "🚀 Starting Ascend infrastructure..."
cd "$(dirname "$0")"

# Start services
docker compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check if services are ready
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "   Waiting for PostgreSQL..."
  sleep 2
done

until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo "   Waiting for Redis..."
  sleep 2
done

echo "✅ Infrastructure is ready!"
echo ""
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
echo ""
echo "Next steps:"
echo "  1. Run migrations: pnpm db:migrate"
echo "  2. Start services: pnpm dev"
echo ""
echo "Optional GUI tools:"
echo "  docker compose up -d pgadmin redis-commander"
echo "  - pgAdmin: http://localhost:5050"
echo "  - Redis Commander: http://localhost:8081"
