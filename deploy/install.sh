#!/bin/bash
# Installs Aina on the server, or updates it to the newest code. Run as root from anywhere:
#   bash /opt/aina/deploy/install.sh
# The first run writes /opt/aina/.env with fresh random passwords; later runs keep it.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml -f deploy/docker-compose.aina.yml"

if [ ! -f .env ]; then
  echo "Writing .env with new random passwords..."
  umask 077
  cat > .env <<ENV
# Aina settings. Keep this file private: it holds the server's passwords.
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SECRET_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
# Test phase: opened through an SSH tunnel at http://localhost:8080 on your computer.
NEXTAUTH_URL=http://localhost:8080
APP_URL=http://localhost:8080
DEBUG=true
DEV_MODE=true
# No AI until the Google key is added.
AI_INTERNAL_ENABLED=false
ENV
fi

echo "Fetching the newest code..."
git pull --ff-only

echo "Building and starting the app (the first time takes 10-20 minutes)..."
$COMPOSE up -d --build

echo "Waiting for the app to start..."
for i in $(seq 1 60); do
  if $COMPOSE exec -T backend curl -fs http://localhost:8000/api/v1/health >/dev/null 2>&1; then break; fi
  sleep 5
done

echo "Updating the database..."
$COMPOSE exec -T backend alembic upgrade head

echo
echo "AINA IS RUNNING"
