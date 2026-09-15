#!/bin/bash

# Database Testing Script for Phase 4
# Validates schema, migrations, and data integrity

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

# Load environment
if [ -f "$PROJECT_ROOT/.env.staging" ]; then
    set -a
    source "$PROJECT_ROOT/.env.staging" 2>/dev/null || true
    set +a
fi

# Start tests
log_title "Phase 4 Database Tests"

echo ""

# Check if containers are running
echo -e "${YELLOW}[1/6] Checking if services are running...${NC}"
if ! docker ps | grep -q "hrms-postgres-staging"; then
    log_info "Starting services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" up -d
    sleep 10
fi

if ! docker exec hrms-postgres-staging pg_isready -U "${POSTGRES_USER:-postgres}" > /dev/null 2>&1; then
    log_fail "PostgreSQL is not running"
    exit 1
fi

log_pass "PostgreSQL is running"

echo ""

# Test 2: Check database exists
echo -e "${YELLOW}[2/6] Checking database...${NC}"
if docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -lqt | cut -d \| -f 1 | grep -w "${POSTGRES_DB:-orbit_hr}" > /dev/null; then
    log_pass "Database '${POSTGRES_DB:-orbit_hr}' exists"
else
    log_fail "Database '${POSTGRES_DB:-orbit_hr}' not found"
fi

echo ""

# Test 3: Check schema
echo -e "${YELLOW}[3/6] Checking schema and tables...${NC}"
TABLE_COUNT=$(docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
    log_pass "Found $TABLE_COUNT tables in schema"
    
    # List some key tables if they exist
    echo -e "${YELLOW}  Key tables:${NC}"
    docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" 2>/dev/null | \
        head -10 | xargs -I {} echo "    - {}"
else
    log_fail "No tables found in database"
fi

echo ""

# Test 4: Check migrations
echo -e "${YELLOW}[4/6] Checking migrations...${NC}"

# Check if _prisma_migrations table exists
if docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
    "SELECT count(*) FROM _prisma_migrations" > /dev/null 2>&1; then
    
    MIGRATION_COUNT=$(docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
        "SELECT count(*) FROM _prisma_migrations" 2>/dev/null || echo "0")
    
    log_pass "Found $MIGRATION_COUNT applied migrations"
    
    # Show last migration
    echo -e "${YELLOW}  Last migration:${NC}"
    docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
        "SELECT name, installed_at FROM _prisma_migrations ORDER BY installed_at DESC LIMIT 1" 2>/dev/null | \
        xargs -I {} echo "    {}"
else
    log_fail "Could not check migration status"
fi

echo ""

# Test 5: Check RLS policies
echo -e "${YELLOW}[5/6] Checking Row-Level Security (RLS)...${NC}"

# Check if RLS is enabled on any tables
RLS_COUNT=$(docker exec hrms-postgres-staging psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-orbit_hr}" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND row_security_active='on'" 2>/dev/null || echo "0")

if [ "$RLS_COUNT" -gt 0 ]; then
    log_pass "RLS is enabled on $RLS_COUNT tables"
else
    log_info "No tables with RLS enabled (may not be required for all tables)"
fi

echo ""

# Test 6: Basic connectivity test
echo -e "${YELLOW}[6/6] Testing API database connectivity...${NC}"

# Try to query through the API if it's running
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:3001/api/health)
    
    if echo "$HEALTH" | grep -q "ok\|healthy\|UP"; then
        log_pass "API database connectivity verified"
    else
        log_info "API health endpoint responded but unclear status"
    fi
else
    log_info "API not running, skipping API connectivity test"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Database Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "${RED}Failed:${NC}  $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All database tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Database Information:${NC}"
    echo -e "  Database:      ${POSTGRES_DB:-orbit_hr}"
    echo -e "  Host:          postgres"
    echo -e "  Port:          5432"
    echo -e "  App User:      orbit_app"
    echo -e "  Tables:        $TABLE_COUNT"
    echo -e "  Migrations:    $MIGRATION_COUNT"
    echo ""
    echo -e "${BLUE}Access Database:${NC}"
    echo -e "  psql postgres://orbit_app:orbit_app_dev_password@localhost:5432/${POSTGRES_DB:-orbit_hr}"
    echo ""
else
    echo -e "${RED}✗ Some database tests failed.${NC}"
    exit 1
fi
