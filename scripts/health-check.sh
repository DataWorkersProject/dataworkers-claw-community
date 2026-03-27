#!/bin/bash
# Health check script for docker-compose services
# Checks: PostgreSQL, Redis, Neo4j, Kafka
# Returns 0 if all healthy, 1 if any unhealthy

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

HEALTHY=0
TOTAL=0
FAILED_SERVICES=""

check_service() {
  local name="$1"
  local cmd="$2"
  local timeout="${3:-5}"
  TOTAL=$((TOTAL + 1))

  printf "Checking %-12s ... " "$name"
  START_MS=$(date +%s%N 2>/dev/null || echo 0)

  if eval "timeout $timeout $cmd" > /dev/null 2>&1; then
    END_MS=$(date +%s%N 2>/dev/null || echo 0)
    if [ "$START_MS" != "0" ] && [ "$END_MS" != "0" ]; then
      LATENCY_MS=$(( (END_MS - START_MS) / 1000000 ))
      printf "${GREEN}healthy${NC} (%dms)\n" "$LATENCY_MS"
    else
      printf "${GREEN}healthy${NC}\n"
    fi
    HEALTHY=$((HEALTHY + 1))
  else
    printf "${RED}unhealthy${NC}\n"
    FAILED_SERVICES="$FAILED_SERVICES $name"
  fi
}

echo "========================================="
echo "  Data Workers Health Check"
echo "========================================="
echo ""

# PostgreSQL
check_service "PostgreSQL" "pg_isready -h localhost -p 5432 -U dw_user -d data_workers"

# Redis
check_service "Redis" "redis-cli -h localhost -p 6379 ping"

# Neo4j
check_service "Neo4j" "curl -sf http://localhost:7474"

# Kafka
check_service "Kafka" "bash -c 'echo > /dev/tcp/localhost/9092'"

echo ""
echo "========================================="
echo "  Results: $HEALTHY/$TOTAL services healthy"
echo "========================================="

if [ "$HEALTHY" -eq "$TOTAL" ]; then
  echo -e "${GREEN}All services are healthy.${NC}"
  exit 0
else
  echo -e "${RED}Unhealthy services:${FAILED_SERVICES}${NC}"
  exit 1
fi
