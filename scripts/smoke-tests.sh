#!/bin/bash

# Smoke Test Suite for Phase 4
# Tests critical endpoints and verifies basic functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_title() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Start tests
log_title "Phase 4 Smoke Tests"

echo ""
echo -e "${YELLOW}Loading environment variables...${NC}"

# Load environment variables from .env.staging if available
if [ -f "$PROJECT_ROOT/.env.staging" ]; then
    # Export only non-empty lines and valid variable names
    set -a
    source "$PROJECT_ROOT/.env.staging" 2>/dev/null || true
    set +a
    log_pass "Environment variables loaded from .env.staging"
else
    log_fail ".env.staging not found"
    exit 1
fi

echo ""

# Step 1: Start Docker containers
echo -e "${YELLOW}Step 1: Starting Docker containers...${NC}"
log_info "Starting docker-compose services..."

if docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" up -d 2>&1 | head -5; then
    log_pass "Docker services started"
else
    log_fail "Failed to start Docker services"
    exit 1
fi

# Wait for services to initialize
echo -e "${YELLOW}Waiting for services to initialize (30 seconds)...${NC}"
sleep 10

echo ""

# Step 2: Wait for PostgreSQL to be healthy
echo -e "${YELLOW}Step 2: Waiting for PostgreSQL...${NC}"
DB_READY=0
for i in {1..60}; do
    if docker exec hrms-postgres-staging pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" > /dev/null 2>&1; then
        DB_READY=1
        log_pass "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ $DB_READY -eq 0 ]; then
    log_fail "PostgreSQL failed to start"
    echo -e "${YELLOW}Database logs:${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" logs postgres | tail -20
    exit 1
fi

echo ""

# Step 3: Wait for API to be healthy
echo -e "${YELLOW}Step 3: Waiting for API service...${NC}"
API_READY=0
for i in {1..60}; do
    if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        API_READY=1
        log_pass "API is ready"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ $API_READY -eq 0 ]; then
    log_fail "API failed to start"
    echo -e "${YELLOW}API logs:${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" logs api | tail -30
    exit 1
fi

# Wait a bit more for migrations
sleep 5

echo ""

# Step 4: Test critical endpoints
echo -e "${YELLOW}Step 4: Testing critical endpoints...${NC}"

# Test 4.1: Health check
echo -e "${YELLOW}  Testing: GET /api/health${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/api/health)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    log_pass "Health check endpoint returns 200"
else
    log_fail "Health check endpoint returned $HTTP_CODE"
fi

echo ""

# Test 4.2: Authentication endpoint
echo -e "${YELLOW}  Testing: POST /auth/login (expected 400 without credentials)${NC}"
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    http://localhost:3001/auth/login)
HTTP_CODE=$(echo "$AUTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
    log_pass "Auth endpoint responds correctly (HTTP $HTTP_CODE)"
else
    log_fail "Auth endpoint returned unexpected status $HTTP_CODE"
fi

echo ""

# Test 4.3: Test database connectivity by checking if migrations ran
echo -e "${YELLOW}Step 5: Verifying database connectivity...${NC}"
echo -e "${YELLOW}  Checking: Database schema and migrations${NC}"

# Check if tables exist in database
TABLES=$(docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")

if [ "$TABLES" -gt 0 ]; then
    log_pass "Database schema exists with $TABLES tables"
else
    log_fail "No tables found in database"
fi

echo ""

# Step 6: Wait for web frontend
echo -e "${YELLOW}Step 6: Checking web frontend...${NC}"
WEB_READY=0
for i in {1..30}; do
    if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        WEB_READY=1
        log_pass "Web frontend is responding"
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ $WEB_READY -eq 0 ]; then
    echo -e "${YELLOW}⚠ Web frontend not responding (may still be building)${NC}"
fi

echo ""

# Step 7: Test environment variables
echo -e "${YELLOW}Step 7: Verifying environment configuration...${NC}"

# Check API environment
API_PORT=$(docker exec hrms-api-staging printenv PORT 2>/dev/null || echo "UNKNOWN")
if [ "$API_PORT" = "3001" ]; then
    log_pass "API PORT is correctly set to 3001"
else
    log_fail "API PORT is not set correctly (got: $API_PORT)"
fi

echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Smoke Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "${RED}Failed:${NC}  $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo -e "  API:              http://localhost:3001/api"
    echo -e "  API Health:       http://localhost:3001/api/health"
    echo -e "  Web Frontend:     http://localhost:3000"
    echo -e "  Database:         postgres://orbit_app:orbit_app_dev_password@localhost:5432/orbit_hr"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  View all logs:    docker-compose -f docker-compose.staging.yml logs -f"
    echo -e "  View API logs:    docker-compose -f docker-compose.staging.yml logs -f api"
    echo -e "  Stop services:    ./scripts/stop-staging.sh"
    echo -e "  Run DB tests:     ./scripts/test-database.sh"
    echo -e "  Run load tests:   ./scripts/load-test.sh"
    echo ""
else
    echo -e "${RED}✗ Some smoke tests failed. Debugging information above.${NC}"
    echo ""
    echo -e "${BLUE}Troubleshooting:${NC}"
    echo -e "  1. Check Docker logs: docker-compose -f docker-compose.staging.yml logs"
    echo -e "  2. Check if ports are in use: lsof -i :3000,3001,5432"
    echo -e "  3. Stop all containers: ./scripts/stop-staging.sh"
    exit 1
fi
