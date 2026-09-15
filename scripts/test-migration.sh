#!/bin/bash
# Migration testing script
# Creates a temporary test database, runs migrations, validates schema, then cleans up
# Exit codes:
#   0 = Success
#   1 = Configuration error
#   2 = Migration failed
#   3 = Schema validation failed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/api"

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

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if PostgreSQL client is available
    if ! command -v psql &> /dev/null; then
        log_error "psql command not found. PostgreSQL client is required."
        return 1
    fi

    # Check if we're in the right directory
    if [ ! -f "$API_DIR/package.json" ]; then
        log_error "Cannot find API directory at $API_DIR"
        return 1
    fi

    # Check required environment variables
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL not set"
        return 1
    fi

    log_info "Prerequisites check passed"
    return 0
}

# Extract database connection info from DATABASE_URL
parse_database_url() {
    # Expected format: postgresql://user:password@host:port/database?schema=public
    local url="$1"

    # Basic parsing (this is a simplified version)
    # In production, consider using a proper URL parser
    DB_HOST=$(echo "$url" | sed -E 's|.*@([^:/?]+).*|\1|')
    DB_PORT=$(echo "$url" | sed -E 's|.*:([0-9]+)/.*|\1|' || echo "5432")
    DB_USER=$(echo "$url" | sed -E 's|postgresql://([^:]+).*|\1|')
    DB_NAME=$(echo "$url" | sed -E 's|.*/([^?]+).*|\1|')

    log_info "Database: $DB_NAME@$DB_HOST:$DB_PORT"
}

# Create test database
create_test_database() {
    local test_db="${DB_NAME}_migration_test_$$"

    log_test "Creating test database: $test_db"

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$test_db'" | grep -q 1; then
        log_warn "Test database already exists, dropping it"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $test_db;" || true
    fi

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $test_db;" || {
        log_error "Failed to create test database"
        return 1
    }

    echo "$test_db"
}

# Run migrations on test database
run_migrations() {
    local test_db="$1"
    local test_database_url="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$test_db"

    log_test "Running migrations on test database"

    cd "$API_DIR"

    DATABASE_URL="$test_database_url" npx prisma migrate deploy --skip-generate || {
        log_error "Migration failed"
        return 2
    }

    log_info "Migrations completed successfully"
    return 0
}

# Validate schema
validate_schema() {
    local test_db="$1"

    log_test "Validating database schema"

    cd "$API_DIR"

    # Check if Prisma client generation works with the new schema
    DATABASE_URL="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$test_db" \
        npx prisma validate || {
        log_error "Schema validation failed"
        return 3
    }

    log_info "Schema validation passed"

    # Count tables
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -d "$test_db" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

    log_test "Tables created: $table_count"

    return 0
}

# Cleanup test database
cleanup_test_database() {
    local test_db="$1"

    log_info "Cleaning up test database: $test_db"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" \
        -c "DROP DATABASE IF EXISTS $test_db;" || {
        log_warn "Failed to drop test database (may require manual cleanup)"
    }
}

# Main execution
main() {
    log_info "Starting migration test"

    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi

    # Parse database URL
    parse_database_url "$DATABASE_URL"

    # Create test database
    TEST_DB=$(create_test_database) || exit 1

    # Run migrations
    if ! run_migrations "$TEST_DB"; then
        cleanup_test_database "$TEST_DB"
        exit 2
    fi

    # Validate schema
    if ! validate_schema "$TEST_DB"; then
        cleanup_test_database "$TEST_DB"
        exit 3
    fi

    # Cleanup
    cleanup_test_database "$TEST_DB"

    log_info "Migration test completed successfully"
    exit 0
}

# Run main
main "$@"
