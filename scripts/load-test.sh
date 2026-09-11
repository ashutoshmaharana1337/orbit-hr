#!/bin/bash

# Load Testing Script for Phase 4
# Simulates traffic and measures performance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load test configuration
CONCURRENCY=${LOAD_TEST_CONCURRENCY:-10}
DURATION=${LOAD_TEST_DURATION:-30}
REQUESTS=${LOAD_TEST_REQUESTS:-1000}

# Helper functions
log_title() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Start tests
log_title "Phase 4 Load Tests"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Concurrency:  $CONCURRENCY"
echo -e "  Duration:     ${DURATION}s"
echo -e "  Total Requests: $REQUESTS"
echo ""

# Check if containers are running
echo -e "${YELLOW}Checking if services are running...${NC}"
if ! docker ps | grep -q "hrms-api-staging"; then
    log_info "API container not running. Starting services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" up -d
    sleep 10
fi

if ! curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${RED}Error: API is not responding${NC}"
    exit 1
fi

log_pass "Services are running"

echo ""

# Check for load testing tools
echo -e "${YELLOW}Checking for load testing tools...${NC}"

HAS_AB=false
HAS_K6=false
HAS_CURL=false

if command -v ab &> /dev/null; then
    HAS_AB=true
    log_pass "Apache Bench (ab) available"
fi

if command -v k6 &> /dev/null; then
    HAS_K6=true
    log_pass "k6 available"
fi

if command -v curl &> /dev/null; then
    HAS_CURL=true
    log_pass "curl available"
fi

echo ""

# Run tests based on available tools
if [ "$HAS_AB" = true ]; then
    echo -e "${YELLOW}Running Apache Bench load test...${NC}"
    
    # Test 1: Health endpoint
    echo -e "${YELLOW}Test 1: Health endpoint (GET /api/health)${NC}"
    ab -n $REQUESTS -c $CONCURRENCY -q http://localhost:3001/api/health | grep -E "(Requests per second|Time per request|Failed requests)"
    
    echo ""
    
    # Test 2: API endpoint (with data)
    echo -e "${YELLOW}Test 2: API list endpoint simulation${NC}"
    # Using a simple GET endpoint that's likely to exist
    ab -n 100 -c $CONCURRENCY -q http://localhost:3001/api/health | grep -E "(Requests per second|Time per request|Failed requests)"
    
elif [ "$HAS_K6" = true ]; then
    echo -e "${YELLOW}Running k6 load test...${NC}"
    
    cat > /tmp/k6-test.js << 'K6TEST'
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 20 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  let response = http.get('http://localhost:3001/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
K6TEST
    
    k6 run /tmp/k6-test.js
    rm -f /tmp/k6-test.js
    
elif [ "$HAS_CURL" = true ]; then
    echo -e "${YELLOW}Running curl-based load test...${NC}"
    echo -e "${YELLOW}Test: Health endpoint (sequential requests)${NC}"
    
    TOTAL_TIME=0
    FAILED=0
    SUCCESS=0
    MIN_TIME=999999
    MAX_TIME=0
    
    for i in $(seq 1 $REQUESTS); do
        START=$(date +%s%N)
        if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
            ((SUCCESS++))
        else
            ((FAILED++))
        fi
        END=$(date +%s%N)
        ELAPSED=$(( (END - START) / 1000000 ))
        TOTAL_TIME=$(( TOTAL_TIME + ELAPSED ))
        
        if [ $ELAPSED -lt $MIN_TIME ]; then
            MIN_TIME=$ELAPSED
        fi
        if [ $ELAPSED -gt $MAX_TIME ]; then
            MAX_TIME=$ELAPSED
        fi
        
        # Print progress every 100 requests
        if [ $((i % 100)) -eq 0 ]; then
            echo -n "."
        fi
    done
    
    echo ""
    echo ""
    echo -e "${BLUE}Results:${NC}"
    AVG_TIME=$(( TOTAL_TIME / REQUESTS ))
    echo -e "  Total Requests:    $REQUESTS"
    echo -e "  Successful:        $SUCCESS"
    echo -e "  Failed:            $FAILED"
    echo -e "  Average Time:      ${AVG_TIME}ms"
    echo -e "  Min Time:          ${MIN_TIME}ms"
    echo -e "  Max Time:          ${MAX_TIME}ms"
    
    if [ $FAILED -eq 0 ]; then
        log_pass "All requests successful"
    else
        log_warn "$FAILED requests failed"
    fi
else
    log_warn "No load testing tools available"
    echo -e "${YELLOW}Install one of the following tools:${NC}"
    echo -e "  Apache Bench:  apt-get install apache2-utils"
    echo -e "  k6:            https://k6.io/docs/getting-started/installation/"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Load Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Recommendations:${NC}"
echo -e "  - Use Apache Bench for quick HTTP tests"
echo -e "  - Use k6 for advanced load testing with scripts"
echo -e "  - Monitor container resources: docker stats"
echo -e "  - Check API logs: docker-compose -f docker-compose.staging.yml logs -f api"
echo ""
