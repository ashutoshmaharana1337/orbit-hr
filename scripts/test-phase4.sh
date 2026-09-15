#!/bin/bash

# Phase 4 Integration Test Runner
# This script validates all Phase 4 components and runs comprehensive integration tests

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
WARNINGS=0

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

log_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Start tests
log_title "Phase 4 Integration Tests"

echo ""
echo -e "${BLUE}Starting comprehensive validation...${NC}"
echo ""

# 1. Check Docker installation
echo -e "${YELLOW}[1/7] Checking Docker installation...${NC}"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_pass "Docker installed: $DOCKER_VERSION"
else
    log_fail "Docker not installed"
    exit 1
fi

if docker ps &> /dev/null; then
    log_pass "Docker daemon is running"
else
    log_fail "Docker daemon is not running"
    exit 1
fi

echo ""

# 2. Validate Dockerfile
echo -e "${YELLOW}[2/7] Validating Dockerfile...${NC}"
if [ -f "$PROJECT_ROOT/api/Dockerfile" ]; then
    log_pass "api/Dockerfile exists"

    # Check for multi-stage build
    if grep -q "FROM.*AS.*" "$PROJECT_ROOT/api/Dockerfile"; then
        log_pass "Multi-stage build detected"
    else
        log_warn "Multi-stage build not found (optional)"
    fi

    # Check for health check
    if grep -q "HEALTHCHECK" "$PROJECT_ROOT/api/Dockerfile"; then
        log_pass "Health check configured"
    else
        log_warn "Health check not configured (optional)"
    fi

    # Check for non-root user
    if grep -q "USER" "$PROJECT_ROOT/api/Dockerfile"; then
        log_pass "Non-root user configured"
    else
        log_warn "Non-root user not configured (security best practice)"
    fi
else
    log_fail "api/Dockerfile not found"
fi

echo ""

# 3. Validate docker-compose
echo -e "${YELLOW}[3/7] Validating docker-compose files...${NC}"
if [ -f "$PROJECT_ROOT/docker-compose.staging.yml" ]; then
    log_pass "docker-compose.staging.yml exists"

    # Validate YAML syntax
    if command -v docker-compose &> /dev/null; then
        if docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" config > /dev/null 2>&1; then
            log_pass "docker-compose.staging.yml is valid YAML"
        else
            log_fail "docker-compose.staging.yml has invalid YAML syntax"
        fi
    else
        log_warn "docker-compose not found, skipping YAML validation"
    fi
else
    log_fail "docker-compose.staging.yml not found"
fi

echo ""

# 4. Validate environment variables
echo -e "${YELLOW}[4/7] Validating environment variable examples...${NC}"
if [ -f "$PROJECT_ROOT/.env.staging" ]; then
    log_pass ".env.staging exists"

    # Check for required env vars
    REQUIRED_VARS=("POSTGRES_USER" "POSTGRES_PASSWORD" "DATABASE_URL" "JWT_SECRET" "WEB_ORIGIN")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" "$PROJECT_ROOT/.env.staging"; then
            log_pass "Environment variable $var is defined"
        else
            log_fail "Required environment variable $var is missing"
        fi
    done
else
    log_fail ".env.staging not found"
fi

if [ -f "$PROJECT_ROOT/.env.test" ]; then
    log_pass ".env.test exists (test environment)"
else
    log_warn ".env.test not found (used for testing)"
fi

if [ -f "$PROJECT_ROOT/api/.env.example" ]; then
    log_pass "api/.env.example exists"
else
    log_warn "api/.env.example not found"
fi

echo ""

# 5. Test Dockerfile build
echo -e "${YELLOW}[5/7] Testing Dockerfile build...${NC}"
log_info "This may take a few minutes..."

# Check if we should skip docker builds in test mode
if [ "${SKIP_DOCKER_BUILD:-0}" == "1" ]; then
    log_warn "Skipping Docker build (SKIP_DOCKER_BUILD=1)"
else
    if docker build -f "$PROJECT_ROOT/api/Dockerfile" -t orbit-hr-api:test "$PROJECT_ROOT" > /tmp/docker_build.log 2>&1; then
        log_pass "Dockerfile builds successfully"

        # Check image size
        IMAGE_SIZE=$(docker images orbit-hr-api:test --format "{{.Size}}")
        log_info "Docker image size: $IMAGE_SIZE"

        # Parse size and warn if too large
        SIZE_IN_MB=$(echo "$IMAGE_SIZE" | grep -oE '[0-9]+' | head -1)
        if [ "$SIZE_IN_MB" -gt 500 ]; then
            log_warn "Docker image size exceeds 500MB ($SIZE_IN_MB MB)"
        else
            log_pass "Docker image size is acceptable"
        fi
    else
        log_fail "Dockerfile build failed"
        echo "Build error details (last 20 lines):"
        tail -20 /tmp/docker_build.log
    fi
fi

echo ""

# 6. Validate required project files
echo -e "${YELLOW}[6/7] Validating required project files...${NC}"
REQUIRED_FILES=(
    "api/Dockerfile"
    "api/.dockerignore"
    "docker-compose.staging.yml"
    ".env.staging"
    "README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        log_pass "$file exists"
    else
        log_fail "$file is missing"
    fi
done

# Check for prisma schema
if [ -f "$PROJECT_ROOT/api/prisma/schema.prisma" ]; then
    log_pass "Prisma schema exists"
else
    log_fail "Prisma schema is missing"
fi

echo ""

# 7. Health check endpoints
echo -e "${YELLOW}[7/7] Validating health check configuration...${NC}"
if grep -q "/api/health" "$PROJECT_ROOT/api/Dockerfile"; then
    log_pass "API health check endpoint is configured in Dockerfile"
else
    log_warn "API health check endpoint not found in Dockerfile"
fi

if grep -q "healthcheck" "$PROJECT_ROOT/docker-compose.staging.yml"; then
    log_pass "Health checks configured in docker-compose"
else
    log_warn "Health checks not configured in docker-compose"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}  $TESTS_PASSED"
echo -e "${RED}Failed:${NC}  $TESTS_FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Run smoke tests:      ${YELLOW}./scripts/smoke-tests.sh${NC}"
    echo -e "  2. Run database tests:   ${YELLOW}./scripts/test-database.sh${NC}"
    echo -e "  3. Run load tests:       ${YELLOW}./scripts/load-test.sh${NC}"
    exit 0
else
    echo -e "${RED}✗ Some validations failed. Please fix the issues above.${NC}"
    exit 1
fi
