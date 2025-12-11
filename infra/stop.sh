#!/bin/bash
set -e

echo "Stopping Ascend infrastructure..."
cd "$(dirname "$0")"

docker compose down

echo "Infrastructure stopped"
echo ""
echo "To remove all data:"
echo "  docker compose down -v"
