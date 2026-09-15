#!/bin/bash

# Health check script for HRMS API
#
# This script performs a health check by calling the /api/health endpoint
# and verifying the response is valid and the service is healthy.
#
# Used by:
# - CI/CD pipelines for smoke tests
# - Docker Compose health checks
# - Kubernetes liveness/readiness probes
# - Manual monitoring
#
# Exit codes:
#   0 - Health check passed
#   1 - Health check failed
#   2 - Invalid arguments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3001}"
TIMEOUT="${TIMEOUT:-5}"
VERBOSE="${VERBOSE:-0}"

# Help text
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --host HOST       API host (default: localhost)"
  echo "  -p, --port PORT       API port (default: 3001)"
  echo "  -t, --timeout SECS    Request timeout in seconds (default: 5)"
  echo "  -v, --verbose         Verbose output"
  echo "  --help                Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                           # Check local API on port 3001"
  echo "  $0 --host api.example.com   # Check remote API"
  echo "  $0 --port 3001 --timeout 10 # Custom timeout"
  exit 2
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--host)
      API_HOST="$2"
      shift 2
      ;;
    -p|--port)
      API_PORT="$2"
      shift 2
      ;;
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE=1
      shift
      ;;
    --help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Build URL
HEALTH_URL="http://${API_HOST}:${API_PORT}/api/health"

# Log function
log() {
  if [ "$VERBOSE" -eq 1 ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
  fi
}

# Success function
success() {
  echo -e "${GREEN}✓${NC} $1"
}

# Error function
error() {
  echo -e "${RED}✗${NC} $1"
}

# Warning function
warning() {
  echo -e "${YELLOW}!${NC} $1"
}

log "Starting health check..."
log "Target: $HEALTH_URL"
log "Timeout: ${TIMEOUT}s"

# Make request and capture response
log "Making request to health endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$HEALTH_URL" 2>/dev/null || echo "")

# Parse response
if [ -z "$RESPONSE" ]; then
  error "No response from server"
  exit 1
fi

# Extract status code (last line) and body (everything else)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

log "HTTP Status: $HTTP_CODE"
log "Response body: $BODY"

# Check HTTP status code
if [ "$HTTP_CODE" != "200" ]; then
  error "Health check failed with HTTP $HTTP_CODE"
  log "Response: $BODY"
  exit 1
fi

# Verify response is valid JSON and contains required fields
if ! command -v jq &> /dev/null; then
  warning "jq not found, skipping JSON validation"
  success "Health check passed (HTTP 200)"
  exit 0
fi

# Parse JSON and check for required fields
STATUS=$(echo "$BODY" | jq -r '.status' 2>/dev/null || echo "")
TIMESTAMP=$(echo "$BODY" | jq -r '.timestamp' 2>/dev/null || echo "")
DATABASE=$(echo "$BODY" | jq -r '.database' 2>/dev/null || echo "")

if [ -z "$STATUS" ] || [ -z "$TIMESTAMP" ] || [ -z "$DATABASE" ]; then
  error "Response missing required fields (status, timestamp, database)"
  log "Response: $BODY"
  exit 1
fi

# Check status value
if [ "$STATUS" != "ok" ]; then
  error "Service status is not 'ok': $STATUS"
  if [ -n "$DATABASE" ]; then
    log "Database status: $DATABASE"
  fi
  log "Response: $BODY"
  exit 1
fi

# Check database status
if [ "$DATABASE" != "connected" ]; then
  error "Database is not connected: $DATABASE"
  log "Response: $BODY"
  exit 1
fi

# Extract and display response time if available
RESPONSE_TIME=$(echo "$BODY" | jq -r '.responseTime' 2>/dev/null || echo "unknown")
if [ "$RESPONSE_TIME" != "unknown" ]; then
  log "Response time: ${RESPONSE_TIME}ms"

  # Warn if response time is slow (> 100ms)
  if [ "$RESPONSE_TIME" -gt 100 ]; then
    warning "Response time is slow: ${RESPONSE_TIME}ms (expected < 100ms)"
  fi
fi

success "Health check passed"
success "Status: $STATUS"
success "Database: $DATABASE"
success "Timestamp: $TIMESTAMP"

exit 0
