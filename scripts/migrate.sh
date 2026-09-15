#!/bin/bash
# Database migration wrapper for HRMS
# Usage: ./scripts/migrate.sh [deploy|reset|seed]
#
# This script manages database migrations and seeding for all environments.
# - deploy: Run pending migrations (production release step)
# - reset: Reset database and reapply all migrations (development only)
# - seed: Run database seed script (populates sample data)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/api"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "$API_DIR/package.json" ]; then
    log_error "Cannot find API directory at $API_DIR"
    exit 1
fi

cd "$API_DIR"

# Main command handler
case "$1" in
    deploy)
        log_info "Running pending migrations..."
        npx prisma migrate deploy
        log_info "Migrations completed successfully"
        ;;
    reset)
        log_warn "This will reset the database - data loss will occur"
        read -p "Are you sure? (type 'yes' to confirm): " confirmation
        if [ "$confirmation" != "yes" ]; then
            log_info "Reset cancelled"
            exit 0
        fi
        log_info "Resetting database and reapplying migrations..."
        npx prisma migrate reset --force
        log_info "Database reset completed"
        ;;
    seed)
        log_info "Running database seed..."
        npx prisma db seed
        log_info "Database seeded successfully"
        ;;
    status)
        log_info "Migration status:"
        npx prisma migrate status
        ;;
    *)
        echo "Database migration wrapper"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Run pending migrations (production release step)"
        echo "  reset     Reset database and reapply all migrations (dev only)"
        echo "  seed      Run database seed script"
        echo "  status    Show migration status"
        echo ""
        echo "Examples:"
        echo "  $0 deploy    # Deploy pending migrations to production"
        echo "  $0 reset     # Reset development database"
        echo "  $0 seed      # Populate sample data"
        exit 1
        ;;
esac
