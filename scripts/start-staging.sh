#!/bin/bash

# HRMS Staging Environment Startup Script
# This script starts the staging environment with all services (PostgreSQL, API, Web)

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
echo -e "${BLUE}   HRMS Staging Environment Startup${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

# Check if .env.staging exists
if [ ! -f "$PROJECT_ROOT/.env.staging" ]; then
    echo -e "${RED}Error: .env.staging not found in $PROJECT_ROOT${NC}"
    exit 1
fi

echo -e "${YELLOW}Loading environment variables from .env.staging${NC}"
cd "$PROJECT_ROOT"

# Start services with docker-compose
echo -e "${YELLOW}Starting Docker containers...${NC}"
docker-compose -f docker-compose.staging.yml up -d

echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
sleep 5

# Check if containers started successfully
if ! docker ps | grep -q "hrms-postgres-staging"; then
    echo -e "${RED}Error: PostgreSQL container failed to start${NC}"
    docker-compose -f docker-compose.staging.yml logs postgres
    exit 1
fi

if ! docker ps | grep -q "hrms-api-staging"; then
    echo -e "${YELLOW}Warning: API container is still starting...${NC}"
fi

# Wait for API to be ready
echo -e "${YELLOW}Waiting for API to be ready (this may take up to 2 minutes)...${NC}"
API_READY=0
for i in {1..120}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        API_READY=1
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ $API_READY -eq 0 ]; then
    echo -e "${YELLOW}Warning: API health check timeout. Continuing anyway...${NC}"
    echo -e "${YELLOW}Check logs with: docker-compose -f docker-compose.staging.yml logs api${NC}"
else
    echo -e "${GREEN}✓ API is ready${NC}"
fi

# Run Prisma migrations
echo -e "${YELLOW}Running Prisma database migrations...${NC}"
if docker exec hrms-api-staging npm run migrate 2>/dev/null || docker exec hrms-api-staging npx prisma migrate deploy 2>/dev/null; then
    echo -e "${GREEN}✓ Database migrations completed${NC}"
else
    echo -e "${YELLOW}Warning: Migrations may have failed or containers not fully ready${NC}"
    echo -e "${YELLOW}You can manually run migrations with:${NC}"
    echo -e "${YELLOW}  docker exec hrms-api-staging npx prisma migrate deploy${NC}"
fi

# Seed database (if seed script exists)
echo -e "${YELLOW}Seeding database with initial data...${NC}"
if docker exec hrms-api-staging npm run prisma:seed 2>/dev/null; then
    echo -e "${GREEN}✓ Database seeding completed${NC}"
else
    echo -e "${YELLOW}Warning: Database seeding may have failed${NC}"
    echo -e "${YELLOW}You can manually seed with:${NC}"
    echo -e "${YELLOW}  docker exec hrms-api-staging npm run prisma:seed${NC}"
fi

# Wait for web to be ready
echo -e "${YELLOW}Waiting for web frontend to be ready...${NC}"
WEB_READY=0
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        WEB_READY=1
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

if [ $WEB_READY -eq 0 ]; then
    echo -e "${YELLOW}Warning: Web frontend not responding. Containers may still be starting.${NC}"
else
    echo -e "${GREEN}✓ Web frontend is ready${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Staging Environment Started${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo -e "  ${YELLOW}Web Frontend:${NC}  http://localhost:3000"
echo -e "  ${YELLOW}API:${NC}            http://localhost:3001/api"
echo -e "  ${YELLOW}API Health:${NC}     http://localhost:3001/api/health"
echo -e "  ${YELLOW}Database:${NC}       postgres://orbit_app:orbit_app_dev_password@localhost:5432/orbit_hr"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  ${YELLOW}View logs:${NC}      docker-compose -f docker-compose.staging.yml logs -f"
echo -e "  ${YELLOW}View API logs:${NC}   docker-compose -f docker-compose.staging.yml logs -f api"
echo -e "  ${YELLOW}View DB logs:${NC}    docker-compose -f docker-compose.staging.yml logs -f postgres"
echo -e "  ${YELLOW}Stop services:${NC}   ./scripts/stop-staging.sh"
echo -e "  ${YELLOW}DB shell:${NC}        psql postgres://orbit_app:orbit_app_dev_password@localhost:5432/orbit_hr"
echo ""
