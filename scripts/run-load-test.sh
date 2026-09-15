#!/bin/bash

# Load Test Runner Script for Phase 5
# Executes k6 load test against the API
# Usage: ./scripts/run-load-test.sh --api-url http://localhost:3001 --token <jwt-token>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default parameters
API_URL="http://localhost:3001/api"
AUTH_TOKEN=""
OUTPUT_DIR="$PROJECT_ROOT/load-test-results"
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --token)
            AUTH_TOKEN="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_title "Load Test Execution"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  API URL:    $API_URL"
echo -e "  Token:      ${AUTH_TOKEN:0:20}..." || echo "  Token:      Not provided"
echo -e "  Output Dir: $OUTPUT_DIR"
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v k6 &> /dev/null; then
    log_error "k6 is not installed"
    echo ""
    echo -e "${YELLOW}Install k6 from: https://k6.io/docs/getting-started/installation/${NC}"
    exit 1
fi

log_pass "k6 is installed ($(k6 version))"

if [ -z "$AUTH_TOKEN" ]; then
    log_error "AUTH_TOKEN is required"
    echo ""
    echo -e "${YELLOW}Usage: $0 --api-url <url> --token <jwt-token>${NC}"
    exit 1
fi

log_pass "Authentication token provided"

# Create output directory
mkdir -p "$OUTPUT_DIR"
log_pass "Output directory ready: $OUTPUT_DIR"

echo ""
log_info "Starting load test..."
log_info "Duration: 9 minutes (2m ramp-up + 5m sustain + 2m ramp-down)"
echo ""

# Run k6 test with options
TEST_SCRIPT="$PROJECT_ROOT/api/tests/load-test.js"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
JSON_REPORT="$OUTPUT_DIR/results_${TIMESTAMP}.json"
HTML_REPORT="$OUTPUT_DIR/results_${TIMESTAMP}.html"

# Export variables for the test script
export BASE_URL="$API_URL"
export AUTH_TOKEN="$AUTH_TOKEN"

# Run k6 with JSON output
if [ "$VERBOSE" = true ]; then
    k6 run \
        --vus 100 \
        --duration 9m \
        --out json="$JSON_REPORT" \
        "$TEST_SCRIPT"
else
    k6 run \
        --vus 100 \
        --duration 9m \
        --out json="$JSON_REPORT" \
        "$TEST_SCRIPT" 2>&1 | tee "$OUTPUT_DIR/run_${TIMESTAMP}.log"
fi

if [ $? -eq 0 ]; then
    log_pass "Load test completed successfully"
else
    log_error "Load test failed"
    exit 1
fi

echo ""
log_info "Generating reports..."

# Parse results from JSON report
if [ -f "$JSON_REPORT" ]; then
    log_pass "JSON report saved: $JSON_REPORT"

    # Extract key metrics using grep and awk
    echo ""
    echo -e "${BLUE}Load Test Results Summary${NC}"
    echo -e "${BLUE}========================================${NC}"

    # Count total requests
    TOTAL_REQS=$(grep -c '"type":"Point"' "$JSON_REPORT" 2>/dev/null || echo "N/A")
    if [ "$TOTAL_REQS" != "N/A" ]; then
        echo -e "${GREEN}Total Requests:${NC} ~$((TOTAL_REQS / 5)) (estimated)"
    fi

    # Show metric summaries if available
    if grep -q '"Trend":"http_req_duration"' "$JSON_REPORT" 2>/dev/null; then
        echo ""
        echo -e "${GREEN}Response Time Metrics:${NC}"
        echo "  See detailed results in: $JSON_REPORT"
    fi

    # Generate HTML report if htmlgenerator available
    if command -v k6 &> /dev/null && k6 version | grep -q "k6"; then
        # k6 has built-in HTML report generation in some versions
        # For now, provide instructions
        echo ""
        echo -e "${YELLOW}To generate an HTML report, you can use k6's browser-based viewer:${NC}"
        echo "  k6 inspect $JSON_REPORT"
    fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Load Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Results Location: $OUTPUT_DIR${NC}"
echo ""
echo -e "${BLUE}Key Metrics to Review:${NC}"
echo "  • Response times (p50, p95, p99)"
echo "  • Error rates"
echo "  • Throughput (requests/second)"
echo "  • VU utilization"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review JSON report: $JSON_REPORT"
echo "  2. Compare against baselines in: docs/PERFORMANCE_BASELINES.md"
echo "  3. Identify bottlenecks if thresholds exceeded"
echo "  4. Optimize slow endpoints (See docs/LOAD_TESTING.md)"
echo ""
