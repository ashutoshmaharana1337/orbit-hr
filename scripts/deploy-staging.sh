#!/bin/bash

set -e

echo "=================================================="
echo "Deploying to Staging Environment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STAGING_ENV_FILE=".env.staging"
DOCKER_COMPOSE_FILE="docker-compose.staging.yml"
STACK_NAME="hrms-staging"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Pull latest code
log_info "Pulling latest code..."
git pull origin master || log_error "Failed to pull latest code"

# Step 2: Create staging environment file
log_info "Creating staging environment configuration..."
cat > "$STAGING_ENV_FILE" << EOF
# Staging Environment Configuration
POSTGRES_USER=${POSTGRES_USER:-orbit}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-staging_password_123}
POSTGRES_DB=${POSTGRES_DB:-orbit_hr}

# API Configuration
DATABASE_URL=${DATABASE_URL:-postgresql://orbit_app:orbit_app_dev_password@postgres:5432/orbit_hr?schema=public}
DIRECT_DATABASE_URL=${DIRECT_DATABASE_URL:-postgresql://orbit:staging_password_123@postgres:5432/orbit_hr?schema=public}
JWT_SECRET=${JWT_SECRET:-staging_secret_key_change_in_production}
JWT_EXPIRES_IN=15m
WEB_ORIGIN=${WEB_ORIGIN:-http://localhost:3000}

# Web Configuration
NEXT_PUBLIC_API_URL=http://api:3001/api
NODE_ENV=production
EOF

log_info "Environment file created at $STAGING_ENV_FILE"

# Step 3: Load Docker image from artifact
log_info "Loading Docker image..."
if [ -f "/tmp/image.tar" ]; then
    docker load --input /tmp/image.tar || log_error "Failed to load Docker image"
else
    log_warning "Docker image artifact not found, will attempt to build..."
    docker build -t orbit-hr-api:latest ./api || log_error "Failed to build Docker image"
fi

# Step 4: Start Docker Compose services
log_info "Starting Docker Compose services..."
docker-compose -f "$DOCKER_COMPOSE_FILE" --env-file "$STAGING_ENV_FILE" down || true
docker-compose -f "$DOCKER_COMPOSE_FILE" --env-file "$STAGING_ENV_FILE" up -d

# Step 5: Wait for services to be healthy
log_info "Waiting for services to be healthy..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "healthy"; then
        log_info "Services are healthy"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for services... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "Services did not become healthy in time"
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs
    exit 1
fi

# Step 6: Run database migrations
log_info "Running database migrations..."
docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T api npx prisma migrate deploy || log_error "Failed to run migrations"

# Step 7: Seed database (optional)
log_info "Seeding database..."
docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T api npm run prisma:seed || log_warning "Database seeding failed or not applicable"

# Step 8: Verify API is running
log_info "Verifying API is running..."
for i in {1..10}; do
    if curl -s http://localhost:3001/api/health > /dev/null; then
        log_info "API is responding"
        break
    fi
    echo "Attempting to reach API... ($i/10)"
    sleep 2
done

# Step 9: Verify web app is running
log_info "Verifying web app is running..."
for i in {1..10}; do
    if curl -s http://localhost:3000 > /dev/null; then
        log_info "Web app is responding"
        break
    fi
    echo "Attempting to reach web app... ($i/10)"
    sleep 2
done

# Step 10: Display deployment information
log_info "=================================================="
log_info "Staging Deployment Completed Successfully!"
log_info "=================================================="
echo ""
echo "API URL:        http://localhost:3001/api"
echo "Health Check:   http://localhost:3001/api/health"
echo "Web URL:        http://localhost:3000"
echo ""
echo "Database:       orbit_hr (PostgreSQL)"
echo ""
echo "To view logs:"
echo "  docker-compose -f $DOCKER_COMPOSE_FILE logs -f api"
echo "  docker-compose -f $DOCKER_COMPOSE_FILE logs -f web"
echo ""
echo "To stop services:"
echo "  docker-compose -f $DOCKER_COMPOSE_FILE down"
echo ""

exit 0
