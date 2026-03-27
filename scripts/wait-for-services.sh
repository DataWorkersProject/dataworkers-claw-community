#!/bin/bash
# Wait for docker-compose services to be healthy.
# Polls Redis, Kafka, PostgreSQL, Neo4j with retries.
# Exits 0 when all healthy, exits 1 after timeout.
#
# Usage: ./scripts/wait-for-services.sh [timeout_seconds]
# Default timeout: 60 seconds

set -uo pipefail

TIMEOUT="${1:-60}"
INTERVAL=2
ELAPSED=0

echo "Waiting for services (timeout: ${TIMEOUT}s)..."

check_all() {
  # PostgreSQL
  pg_isready -h localhost -p 5432 -U dw_user -d data_workers > /dev/null 2>&1 || return 1
  # Redis
  redis-cli -h localhost -p 6379 ping > /dev/null 2>&1 || return 1
  # Neo4j
  curl -sf http://localhost:7474 > /dev/null 2>&1 || return 1
  # Kafka
  (echo > /dev/tcp/localhost/9092) > /dev/null 2>&1 || return 1
  return 0
}

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  if check_all; then
    echo "All services healthy after ${ELAPSED}s"
    exit 0
  fi
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
  echo "  Waiting... (${ELAPSED}s/${TIMEOUT}s)"
done

echo "ERROR: Services not healthy after ${TIMEOUT}s"
# Run the detailed health check for diagnostics
bash "$(dirname "$0")/health-check.sh" || true
exit 1
