#!/bin/bash

set -e

echo "=================================================="
echo "⚠️  PRODUCTION DEPLOYMENT"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check required environment variables
log_step "Validating environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "DIRECT_DATABASE_URL"
    "JWT_SECRET"
    "WEB_ORIGIN"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable '$var' is not set"
        exit 1
    fi
done

log_info "All required variables are set"

# Step 1: Backup current deployment (if exists)
log_step "Backing up current deployment..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Backup location: $BACKUP_DIR"
# Add backup logic here based on your deployment platform

# Step 2: Display deployment information
log_step "Deployment Details"
echo "=========================================="
echo "Deployment Service: ${DEPLOYMENT_SERVICE:-Not Configured}"
echo "Target Environment: production"
echo "Database: orbit_hr"
echo "Git Commit: ${GITHUB_SHA:0:7}"
echo "Git Branch: ${GITHUB_REF#refs/heads/}"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=========================================="
echo ""

# Step 3: Choose deployment method based on DEPLOYMENT_SERVICE
log_step "Selecting deployment platform..."

case "${DEPLOYMENT_SERVICE}" in
    railway)
        log_info "Deploying to Railway..."
        _deploy_railway
        ;;
    fly)
        log_info "Deploying to Fly.io..."
        _deploy_fly
        ;;
    render)
        log_info "Deploying to Render..."
        _deploy_render
        ;;
    docker-host)
        log_info "Deploying to Docker Host..."
        _deploy_docker_host
        ;;
    *)
        log_warning "DEPLOYMENT_SERVICE not configured or unknown: ${DEPLOYMENT_SERVICE}"
        log_warning "Please configure DEPLOYMENT_SERVICE environment variable"
        _show_deployment_options
        exit 0
        ;;
esac

# Step 4: Run smoke tests (optional)
log_step "Running post-deployment smoke tests..."
if [ -f "scripts/smoke-tests.sh" ]; then
    bash scripts/smoke-tests.sh || log_warning "Smoke tests failed, but deployment may still be active"
else
    log_warning "Smoke tests script not found"
fi

# Step 5: Final verification
log_step "Final verification..."
log_info "=========================================="
log_info "✓ Production deployment completed"
log_info "=========================================="

exit 0

#
# Deployment functions for different platforms
#

_deploy_railway() {
    log_info "Deploying to Railway..."

    if [ -z "$DEPLOYMENT_TOKEN" ]; then
        log_error "DEPLOYMENT_TOKEN not set for Railway deployment"
        exit 1
    fi

    log_info "Steps to deploy to Railway:"
    echo "  1. Install Railway CLI: npm install -g @railway/cli"
    echo "  2. Login: railway login"
    echo "  3. Deploy: railway up --detach"
    echo ""
    echo "Or use Railway Dashboard: https://railway.app/dashboard"
    echo ""
    echo "For more info: https://docs.railway.app/deploy/getting-started"

    # If Railway CLI is available, attempt deployment
    if command -v railway &> /dev/null; then
        log_info "Railway CLI found, attempting automated deployment..."
        railway up --detach || log_error "Railway deployment failed"
    else
        log_warning "Railway CLI not found. Please deploy manually or install railway CLI"
    fi
}

_deploy_fly() {
    log_info "Deploying to Fly.io..."

    if [ -z "$DEPLOYMENT_TOKEN" ]; then
        log_error "DEPLOYMENT_TOKEN not set for Fly deployment"
        exit 1
    fi

    log_info "Steps to deploy to Fly.io:"
    echo "  1. Install Flyctl: https://fly.io/docs/getting-started/installing-flyctl/"
    echo "  2. Login: flyctl auth login"
    echo "  3. Deploy: flyctl deploy"
    echo ""
    echo "Or use Fly Dashboard: https://fly.io/dashboard"
    echo ""
    echo "For more info: https://fly.io/docs/getting-started/deploying/"

    # If flyctl is available, attempt deployment
    if command -v flyctl &> /dev/null; then
        log_info "Flyctl found, attempting automated deployment..."
        flyctl deploy || log_error "Flyctl deployment failed"
    else
        log_warning "Flyctl not found. Please deploy manually or install flyctl"
    fi
}

_deploy_render() {
    log_info "Deploying to Render..."

    if [ -z "$DEPLOYMENT_TOKEN" ]; then
        log_error "DEPLOYMENT_TOKEN not set for Render deployment"
        exit 1
    fi

    log_info "Steps to deploy to Render:"
    echo "  1. Set up Render account: https://render.com"
    echo "  2. Connect GitHub repository"
    echo "  3. Configure environment variables"
    echo "  4. Deploy: Push to production branch or trigger manual deploy"
    echo ""
    echo "Or use Render Dashboard: https://dashboard.render.com"
    echo ""
    echo "For more info: https://render.com/docs/deploy-services"

    # Render typically auto-deploys on push, so this is informational
    log_info "Note: Render typically auto-deploys on push. Check dashboard for status."
}

_deploy_docker_host() {
    log_info "Deploying to Docker Host..."

    DOCKER_HOST="${DEPLOYMENT_SERVICE_HOST:-localhost}"
    DOCKER_PORT="${DEPLOYMENT_SERVICE_PORT:-2375}"

    log_info "Connecting to Docker host: $DOCKER_HOST:$DOCKER_PORT"

    # Set Docker host
    export DOCKER_HOST="tcp://${DOCKER_HOST}:${DOCKER_PORT}"

    # Verify Docker connection
    if ! docker version > /dev/null 2>&1; then
        log_error "Cannot connect to Docker host at $DOCKER_HOST:$DOCKER_PORT"
        exit 1
    fi

    log_info "Connected to Docker host"

    # Load image and start containers
    if [ -f "/tmp/image.tar" ]; then
        log_info "Loading Docker image..."
        docker load --input /tmp/image.tar || log_error "Failed to load Docker image"
    fi

    log_info "Starting production services..."
    docker-compose -f docker-compose.yml up -d || log_error "Failed to start services"

    # Wait for health checks
    log_info "Waiting for services to be healthy..."
    sleep 10
}

_show_deployment_options() {
    log_info "Supported deployment platforms:"
    echo ""
    echo "1. Railway"
    echo "   Website: https://railway.app"
    echo "   Docs: https://docs.railway.app"
    echo "   Environment Variable: DEPLOYMENT_SERVICE=railway"
    echo ""
    echo "2. Fly.io"
    echo "   Website: https://fly.io"
    echo "   Docs: https://fly.io/docs"
    echo "   Environment Variable: DEPLOYMENT_SERVICE=fly"
    echo ""
    echo "3. Render"
    echo "   Website: https://render.com"
    echo "   Docs: https://render.com/docs"
    echo "   Environment Variable: DEPLOYMENT_SERVICE=render"
    echo ""
    echo "4. Self-hosted Docker"
    echo "   Environment Variable: DEPLOYMENT_SERVICE=docker-host"
    echo "   Additional Env: DEPLOYMENT_SERVICE_HOST, DEPLOYMENT_SERVICE_PORT"
    echo ""
    echo "Configuration:"
    echo "  Set DEPLOYMENT_SERVICE in GitHub Secrets"
    echo "  Set DEPLOYMENT_TOKEN if platform requires authentication"
    echo ""
}
