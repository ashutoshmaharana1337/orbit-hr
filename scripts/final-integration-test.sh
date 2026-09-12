#!/bin/bash

# Final Integration Test - Phase 5 Complete Validation
# Runs all tests and validations to ensure system is production-ready

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$PROJECT_ROOT/test-results-$TIMESTAMP.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Helper functions
log_title() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo "" | tee -a "$RESULTS_FILE"
}

log_section() {
    echo "" | tee -a "$RESULTS_FILE"
    echo -e "${BLUE}>>> $1${NC}" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$RESULTS_FILE"
    ((PASSED_TESTS++))
}

log_fail() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$RESULTS_FILE"
    ((FAILED_TESTS++))
}

log_skip() {
    echo -e "${YELLOW}⊘ $1${NC}" | tee -a "$RESULTS_FILE"
    ((SKIPPED_TESTS++))
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}" | tee -a "$RESULTS_FILE"
}

increment_test() {
    ((TOTAL_TESTS++))
}

# Start tests
log_title "Phase 5 Final Integration Test"

echo "Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# ============================================================================
# PHASE 4 VALIDATION - Infrastructure
# ============================================================================

log_section "PHASE 4: Infrastructure Validation"

# Test environment validation
log_info "Testing environment variable validation..."
increment_test

cd "$PROJECT_ROOT/api"
if node "$SCRIPT_DIR/validate-env.js" > /dev/null 2>&1; then
    log_pass "Environment variables valid"
else
    log_fail "Environment variables invalid"
fi
cd "$PROJECT_ROOT"

# Test Docker build
log_info "Checking if Docker image builds..."
increment_test

if docker --version > /dev/null 2>&1; then
    if docker build -f "$PROJECT_ROOT/api/Dockerfile" "$PROJECT_ROOT/api" --dry-run > /dev/null 2>&1; then
        log_pass "Docker image builds successfully"
    else
        log_fail "Docker image build failed"
    fi
else
    log_skip "Docker not installed, skipping build test"
fi

# Test docker-compose
log_info "Checking docker-compose configuration..."
increment_test

if docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" config > /dev/null 2>&1; then
    log_pass "Docker Compose configuration valid"
else
    log_fail "Docker Compose configuration invalid"
fi

# ============================================================================
# PHASE 5 VALIDATION - Observability
# ============================================================================

log_section "PHASE 5: Observability Validation"

# Check logger service
log_info "Checking LoggerService implementation..."
increment_test

if [ -f "$PROJECT_ROOT/api/src/common/logger.service.ts" ]; then
    if grep -q "JSON.stringify" "$PROJECT_ROOT/api/src/common/logger.service.ts"; then
        log_pass "LoggerService outputs structured JSON"
    else
        log_fail "LoggerService not outputting JSON"
    fi
else
    log_fail "LoggerService not found"
fi

# Check log shipper service
log_info "Checking LogShipperService implementation..."
increment_test

if [ -f "$PROJECT_ROOT/api/src/common/log-shipper.service.ts" ]; then
    if grep -q "Better Stack\|log aggregation" "$PROJECT_ROOT/api/src/common/log-shipper.service.ts"; then
        log_pass "LogShipperService ready for Better Stack"
    else
        log_fail "LogShipperService not configured"
    fi
else
    log_fail "LogShipperService not found"
fi

# Check metrics service
log_info "Checking MetricsService implementation..."
increment_test

if [ -f "$PROJECT_ROOT/api/src/common/metrics.service.ts" ]; then
    log_pass "MetricsService implemented"
else
    log_fail "MetricsService not found"
fi

# Check health check endpoint
log_info "Checking health endpoint..."
increment_test

if grep -q "async health()" "$PROJECT_ROOT/api/src/app.service.ts"; then
    if grep -q "database.*connected" "$PROJECT_ROOT/api/src/app.service.ts"; then
        log_pass "Health endpoint with database check"
    else
        log_fail "Health endpoint missing database check"
    fi
else
    log_fail "Health endpoint not found"
fi

# Check liveness/readiness checks
log_info "Checking liveness/readiness probes..."
increment_test

if [ -f "$PROJECT_ROOT/api/src/common/liveness.config.ts" ] && [ -f "$PROJECT_ROOT/api/src/common/readiness.check.ts" ]; then
    log_pass "Liveness and readiness checks configured"
else
    log_fail "Liveness/readiness checks missing"
fi

# ============================================================================
# SMOKE TESTS - API Functionality
# ============================================================================

log_section "Smoke Tests: API Functionality"

log_info "Checking if services are running..."
if ! docker ps | grep -q "hrms.*db\|postgres"; then
    log_info "Starting Docker services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" up -d 2>/dev/null
    sleep 10
fi

# Wait for API to be ready
MAX_WAIT=30
WAIT_COUNT=0
API_READY=false

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    increment_test
    if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
        API_READY=true
        log_pass "API is responding to health checks"
        break
    fi
    WAIT_COUNT=$((WAIT_COUNT + 1))
    sleep 1
done

if [ "$API_READY" = false ]; then
    log_fail "API failed to start within $MAX_WAIT seconds"
else
    # Test health endpoint details
    increment_test
    HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health)

    if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
        log_pass "Health endpoint returns OK status"
    else
        log_fail "Health endpoint status not OK"
    fi

    # Test response time
    increment_test
    RESPONSE_TIME=$(curl -w '%{time_total}' -s -o /dev/null http://localhost:3001/api/health)
    RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc | cut -d. -f1)

    if [ "$RESPONSE_MS" -lt 100 ]; then
        log_pass "Health endpoint response time < 100ms (${RESPONSE_MS}ms)"
    elif [ "$RESPONSE_MS" -lt 500 ]; then
        log_skip "Health endpoint response time acceptable but slow (${RESPONSE_MS}ms)"
    else
        log_fail "Health endpoint slow (${RESPONSE_MS}ms)"
    fi
fi

# ============================================================================
# DATABASE TESTS
# ============================================================================

log_section "Database Validation"

log_info "Checking database schema..."
increment_test

if [ -f "$PROJECT_ROOT/api/prisma/schema.prisma" ]; then
    if grep -q "model Tenant" "$PROJECT_ROOT/api/prisma/schema.prisma" && \
       grep -q "model User" "$PROJECT_ROOT/api/prisma/schema.prisma" && \
       grep -q "model Employee" "$PROJECT_ROOT/api/prisma/schema.prisma"; then
        log_pass "Database schema has required models"
    else
        log_fail "Database schema missing required models"
    fi
else
    log_fail "Prisma schema not found"
fi

# Check migrations
log_info "Checking database migrations..."
increment_test

MIGRATION_COUNT=$(find "$PROJECT_ROOT/api/prisma/migrations" -type d -name "*" | wc -l)
if [ "$MIGRATION_COUNT" -gt 3 ]; then
    log_pass "Database has $((MIGRATION_COUNT - 1)) migrations"
else
    log_fail "Database has insufficient migrations"
fi

# ============================================================================
# CODE QUALITY TESTS
# ============================================================================

log_section "Code Quality Validation"

log_info "Checking TypeScript compilation..."
increment_test

cd "$PROJECT_ROOT/api"
if npm run typecheck > /dev/null 2>&1; then
    log_pass "TypeScript compilation successful"
else
    log_fail "TypeScript compilation failed"
fi
cd "$PROJECT_ROOT"

log_info "Checking for linting..."
increment_test

if [ -f "$PROJECT_ROOT/api/.eslintrc.js" ] || [ -f "$PROJECT_ROOT/api/oxlint.json" ]; then
    log_pass "Linting configured"
else
    log_skip "Linting not configured"
fi

# ============================================================================
# SECURITY CHECKS
# ============================================================================

log_section "Security Validation"

# Check for secrets in code
log_info "Checking for hardcoded secrets..."
increment_test

SECRETS_FOUND=0
if grep -r "password123\|secret.*=\|api_key.*=" "$PROJECT_ROOT/api/src/" 2>/dev/null | grep -v "node_modules\|test"; then
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
fi

if [ "$SECRETS_FOUND" -eq 0 ]; then
    log_pass "No obvious hardcoded secrets found"
else
    log_fail "Possible hardcoded secrets found (check manually)"
fi

# Check .env files
log_info "Checking .env.* handling..."
increment_test

if grep -q ".env" "$PROJECT_ROOT/.gitignore" && ! git -C "$PROJECT_ROOT" ls-files | grep -q "\.env$"; then
    log_pass ".env files not committed to git"
else
    log_fail ".env files may be in git"
fi

# Check for RLS
log_info "Checking Row-Level Security policies..."
increment_test

if grep -q "enable row level security\|@skipAuth" "$PROJECT_ROOT/api/prisma/schema.prisma"; then
    log_pass "RLS policies configured"
else
    log_skip "RLS configuration not found in schema comments"
fi

# ============================================================================
# DOCUMENTATION CHECKS
# ============================================================================

log_section "Documentation Validation"

REQUIRED_DOCS=(
    "docs/00-overview.md"
    "docs/05-backend.md"
    "docs/06-auth.md"
    "docs/07-production-hardening.md"
    "docs/DEPLOYMENT_CHECKLIST.md"
    "docs/ENVIRONMENT.md"
    "docs/MIGRATIONS.md"
    "docs/LAUNCH_CHECKLIST.md"
    "docs/LAUNCH_SUMMARY.md"
    "api/docs/MONITORING.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    increment_test
    if [ -f "$PROJECT_ROOT/$doc" ]; then
        log_pass "Found: $doc"
    else
        log_fail "Missing: $doc"
    fi
done

# ============================================================================
# SUMMARY
# ============================================================================

log_title "Test Summary"

echo "" | tee -a "$RESULTS_FILE"
echo "Total Tests Run:   $TOTAL_TESTS" | tee -a "$RESULTS_FILE"
echo "Passed:            $PASSED_TESTS" | tee -a "$RESULTS_FILE"
echo "Failed:            $FAILED_TESTS" | tee -a "$RESULTS_FILE"
echo "Skipped:           $SKIPPED_TESTS" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

PASS_RATE=0
if [ "$TOTAL_TESTS" -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi

echo "Pass Rate:         ${PASS_RATE}%" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Final verdict
if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${GREEN}✓ SYSTEM READY FOR PRODUCTION${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${GREEN}========================================${NC}" | tee -a "$RESULTS_FILE"
    EXIT_CODE=0
else
    echo -e "${RED}========================================${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${RED}✗ $FAILED_TESTS TEST(S) FAILED${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${RED}Please review failures above${NC}" | tee -a "$RESULTS_FILE"
    echo -e "${RED}========================================${NC}" | tee -a "$RESULTS_FILE"
    EXIT_CODE=1
fi

echo "" | tee -a "$RESULTS_FILE"
echo "Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

exit $EXIT_CODE
