#!/bin/bash

# HRMS Staging Environment Shutdown Script
# This script gracefully stops all staging services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   HRMS Staging Environment Shutdown${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check if any containers are running
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.staging.yml ps -q 2>/dev/null || true)

if [ -z "$RUNNING_CONTAINERS" ]; then
    echo -e "${YELLOW}No staging containers are currently running${NC}"
    exit 0
fi

echo -e "${YELLOW}Stopping all staging services...${NC}"

# Stop containers gracefully
docker-compose -f docker-compose.staging.yml down --remove-orphans

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Staging Environment Stopped${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}To remove data volumes, run:${NC}"
echo -e "  ${YELLOW}docker-compose -f docker-compose.staging.yml down -v${NC}"
echo ""
