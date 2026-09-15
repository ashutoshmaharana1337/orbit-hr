#!/bin/bash
# Production release script with database migration management
# Validates environment, backs up database, runs migrations, validates health
# Exit codes:
#   0 = Success
#   1 = Validation failed
#   2 = Backup failed
#   3 = Migration failed
#   4 = Health check failed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Validate environment
validate_environment() {
    log_step "Validating environment"

    # Check if running in CI/CD or explicitly approved
    if [ -z "$FORCE_RELEASE" ] && [ -z "$CI" ] && [ -z "$GITHUB_ACTIONS" ]; then
        log_warn "Not running in CI environment. Set FORCE_RELEASE=1 to continue."
        read -p "Continue with release? (yes/no): " confirmation
        if [ "$confirmation" != "yes" ]; then
            log_error "Release cancelled by user"
            return 1
        fi
    fi

    # Check required environment variables
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL not set"
        return 1
    fi

    if [ -z "$DIRECT_DATABASE_URL" ]; then
        log_warn "DIRECT_DATABASE_URL not set (required for migrations)"
    fi

    # Check API directory exists
    if [ ! -f "$PROJECT_ROOT/api/package.json" ]; then
        log_error "Cannot find API directory"
        return 1
    fi

    log_info "Environment validation passed"
    return 0
}

# Backup database
backup_database() {
    log_step "Backing up database"

    # Only backup if we have a DIRECT_DATABASE_URL
    if [ -z "$DIRECT_DATABASE_URL" ]; then
        log_warn "Skipping database backup (DIRECT_DATABASE_URL not set)"
        return 0
    fi

    local backup_dir="$PROJECT_ROOT/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/hrms_backup_${timestamp}.sql"

    # Create backups directory if it doesn't exist
    mkdir -p "$backup_dir"

    # Extract database name from DIRECT_DATABASE_URL
    local db_name=$(echo "$DIRECT_DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
    local db_host=$(echo "$DIRECT_DATABASE_URL" | sed -E 's|.*@([^:/?]+).*|\1|')
    local db_port=$(echo "$DIRECT_DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|' || echo "5432")
    local db_user=$(echo "$DIRECT_DATABASE_URL" | sed -E 's|postgresql://([^:]+).*|\1|')

    log_info "Creating database backup: $backup_file"

    # Attempt backup
    if ! pg_dump -h "$db_host" -p "$db_port" -U "$db_user" \
        -F c -b -v -f "$backup_file" "$db_name" 2>/dev/null; then
        log_error "Database backup failed"
        log_warn "Continuing with release (backup tools may not be available)"
        return 0
    fi

    log_info "Database backup completed: $backup_file"
    echo "$backup_file"
}

# Run migrations
run_migrations() {
    log_step "Running database migrations"

    cd "$PROJECT_ROOT/api"

    if ! npx prisma migrate deploy; then
        log_error "Migration failed"
        return 3
    fi

    log_info "Migrations completed successfully"
    return 0
}

# Validate migrations
validate_migrations() {
    log_step "Validating migration status"

    cd "$PROJECT_ROOT/api"

    # Check if there are any pending migrations
    migration_status=$(npx prisma migrate status 2>&1 || true)

    if echo "$migration_status" | grep -q "pending"; then
        log_warn "Pending migrations detected after deploy"
        log_warn "This may indicate a migration failure"
        return 1
    fi

    log_info "Migration validation passed"
    return 0
}

# Health check
health_check() {
    log_step "Performing health checks"

    # Wait for API to be ready
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if [ -n "$API_HEALTH_URL" ]; then
            if curl -sf "$API_HEALTH_URL/health" > /dev/null 2>&1; then
                log_info "API health check passed"
                return 0
            fi
        else
            log_warn "API_HEALTH_URL not set, skipping health check"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "API health check failed after $max_attempts attempts"
    return 4
}

# Provide rollback instructions
rollback_instructions() {
    local backup_file="$1"

    log_step "Rollback instructions (save these!)"

    cat << 'EOF'

==============================================================================
ROLLBACK PROCEDURE
==============================================================================

If you need to rollback this release:

1. Identify the previous migration:
   cd api && npx prisma migrate status

2. Rollback to previous migration (requires SQL file):
   - Locate the SQL file for the previous migration in api/prisma/migrations/
   - Restore from backup (if available)

3. Manual rollback example:
   psql -d $DATABASE_URL -f api/prisma/migrations/[previous_migration]/migration.sql

4. For database restore from backup:
EOF

    if [ -n "$backup_file" ] && [ -f "$backup_file" ]; then
        cat << EOF
   pg_restore -d \$DATABASE_URL "$backup_file"
EOF
    else
        cat << 'EOF'
   pg_restore -d $DATABASE_URL $BACKUP_FILE
EOF
    fi

    cat << 'EOF'

5. After rollback, restart the API:
   docker-compose restart api

==============================================================================
Note: Keep this output for your records. Backup files are stored in /backups
==============================================================================

EOF
}

# Main execution
main() {
    log_info "Starting production release with migration management"
    echo ""

    # Validate environment
    if ! validate_environment; then
        log_error "Environment validation failed"
        exit 1
    fi

    # Backup database
    backup_file=$(backup_database) || exit 2

    # Run migrations
    if ! run_migrations; then
        log_error "Migration failed - check database backup for recovery options"
        if [ -n "$backup_file" ]; then
            rollback_instructions "$backup_file"
        fi
        exit 3
    fi

    # Validate migrations
    if ! validate_migrations; then
        log_warn "Migration validation warnings detected"
    fi

    # Health check (if API is running)
    health_check || log_warn "Health check not available yet (API may still be starting)"

    echo ""
    log_info "Release completed successfully"
    rollback_instructions "$backup_file"
}

# Run main
main "$@"
