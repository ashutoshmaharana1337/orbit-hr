#!/bin/sh
# Docker entrypoint script for NestJS API
# Performs pre-startup validation and optional database setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting Orbit HR API..."

# Check required environment variables
check_env_var() {
    local var_name=$1
    local var_value=$(eval echo \$$var_name)

    if [ -z "$var_value" ]; then
        echo -e "${RED}ERROR: Environment variable ${var_name} is not set${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} ${var_name} is set"
}

echo -e "\n${YELLOW}Validating required environment variables...${NC}"
check_env_var "DATABASE_URL"
check_env_var "JWT_SECRET"

# Log configuration (without secrets)
echo -e "\n${YELLOW}Configuration:${NC}"
echo "NODE_ENV: ${NODE_ENV:-production}"
echo "PORT: ${PORT:-3001}"
echo "WEB_ORIGIN: ${WEB_ORIGIN:-not set}"
echo "TZ: ${TZ:-UTC}"

# Optional: Wait for database to be ready (uncomment if needed)
# if [ "$WAIT_FOR_DB" = "true" ]; then
#     echo -e "\n${YELLOW}Waiting for database to be ready...${NC}"
#     max_attempts=30
#     attempt=1
#     while [ $attempt -le $max_attempts ]; do
#         if node -e "require('http').get('http://localhost:$PORT/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" 2>/dev/null; then
#             echo -e "${GREEN}✓${NC} Database is ready"
#             break
#         fi
#         echo "Attempt $attempt/$max_attempts: Waiting for database..."
#         sleep 2
#         attempt=$((attempt + 1))
#     done
#     if [ $attempt -gt $max_attempts ]; then
#         echo -e "${RED}ERROR: Database did not become ready in time${NC}"
#         exit 1
#     fi
# fi

echo -e "\n${GREEN}Pre-startup checks passed. Starting application...${NC}\n"

# Execute the main application
exec "$@"
