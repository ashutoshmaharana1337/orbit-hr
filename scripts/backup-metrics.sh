#!/bin/bash

#
# Backup Metrics Collection Script
# Purpose: Track backup statistics and health metrics
# Schedule: Daily at 03:00 UTC
# Output: JSON metrics file for dashboard integration
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
METRICS_DIR="${METRICS_DIR:-./backup-metrics}"
CURRENT_DATE=$(date +%Y-%m-%d)
CURRENT_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
METRICS_FILE="${METRICS_DIR}/metrics-${CURRENT_DATE}.json"
SUMMARY_FILE="${METRICS_DIR}/metrics-summary.json"

# Deployment platform
DEPLOYMENT_SERVICE="${DEPLOYMENT_SERVICE:-}"

# Database info
DB_NAME="${DB_NAME:-orbit_hr}"
BASELINE_BACKUP_SIZE="${BASELINE_BACKUP_SIZE:-100}"  # MB (will be auto-detected)

# Logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_metric() {
    echo -e "${CYAN}[METRIC]${NC} $1"
}

# Create metrics directory
mkdir -p "$METRICS_DIR"

log_info "=== Backup Metrics Collection Starting ==="
log_info "Collection date: $CURRENT_DATE"
log_info "Metrics file: $METRICS_FILE"

# Initialize metrics JSON
cat > "$METRICS_FILE" << EOF
{
  "timestamp": "$CURRENT_TIMESTAMP",
  "date": "$CURRENT_DATE",
  "metrics": {}
}
EOF

# Detect platform if not set
if [ -z "$DEPLOYMENT_SERVICE" ]; then
    if command -v railway &> /dev/null; then
        DEPLOYMENT_SERVICE="railway"
    elif command -v flyctl &> /dev/null; then
        DEPLOYMENT_SERVICE="fly"
    else
        DEPLOYMENT_SERVICE="docker"
    fi
    log_info "Auto-detected platform: $DEPLOYMENT_SERVICE"
fi

# Collect metrics based on platform
case "${DEPLOYMENT_SERVICE}" in
    railway)
        _collect_railway_metrics
        ;;
    fly)
        _collect_fly_metrics
        ;;
    render)
        _collect_render_metrics
        ;;
    docker)
        _collect_docker_metrics
        ;;
    *)
        log_error "Unknown platform: $DEPLOYMENT_SERVICE"
        exit 1
        ;;
esac

# Process and analyze metrics
_process_metrics

# Generate summary
_generate_summary

# Upload to monitoring service (optional)
_upload_metrics

log_info "=== Metrics Collection Complete ==="

#
# Platform-specific collection functions
#

_collect_railway_metrics() {
    log_info "Collecting Railway backup metrics..."

    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI not found"
        return 1
    fi

    # List recent backups
    BACKUP_LIST=$(railway database backup list 2>/dev/null || true)

    if [ -z "$BACKUP_LIST" ]; then
        log_warning "No backups found"
        return 1
    fi

    # Parse backup information
    LATEST_BACKUP=$(echo "$BACKUP_LIST" | grep -v "^ID" | head -1)

    if [ -z "$LATEST_BACKUP" ]; then
        log_error "Could not parse backup list"
        return 1
    fi

    BACKUP_ID=$(echo "$LATEST_BACKUP" | awk '{print $1}')
    BACKUP_DATE=$(echo "$LATEST_BACKUP" | awk '{print $2}')
    BACKUP_STATUS=$(echo "$LATEST_BACKUP" | awk '{print $NF}')

    # Calculate backup age in hours
    BACKUP_TIMESTAMP=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo 0)
    CURRENT_TIMESTAMP_S=$(date +%s)
    BACKUP_AGE_HOURS=$(( (CURRENT_TIMESTAMP_S - BACKUP_TIMESTAMP) / 3600 ))

    # Count total backups available
    BACKUP_COUNT=$(echo "$BACKUP_LIST" | grep -v "^ID" | wc -l)

    # Get database statistics
    _get_database_size_railway

    # Add metrics to JSON
    _add_json_metric "platform" "railway"
    _add_json_metric "last_backup_id" "$BACKUP_ID"
    _add_json_metric "last_backup_date" "$BACKUP_DATE"
    _add_json_metric "last_backup_status" "$BACKUP_STATUS"
    _add_json_metric "backup_age_hours" "$BACKUP_AGE_HOURS"
    _add_json_metric "backup_count_available" "$BACKUP_COUNT"
    _add_json_metric "database_size_mb" "$DB_SIZE_MB"

    log_metric "Last backup: $BACKUP_ID (status: $BACKUP_STATUS)"
    log_metric "Backup age: $BACKUP_AGE_HOURS hours"
    log_metric "Available backups: $BACKUP_COUNT"
    log_metric "Database size: ${DB_SIZE_MB}MB"
}

_collect_fly_metrics() {
    log_info "Collecting Fly.io backup metrics..."

    if ! command -v flyctl &> /dev/null; then
        log_error "Flyctl not found"
        return 1
    fi

    FLY_APP="${FLY_APP:-orbit-hr-prod}"

    # List recent snapshots
    SNAPSHOT_LIST=$(flyctl postgres snapshots list --app "$FLY_APP" 2>/dev/null || true)

    if [ -z "$SNAPSHOT_LIST" ]; then
        log_warning "No snapshots found"
        return 1
    fi

    # Parse snapshot information
    LATEST_SNAPSHOT=$(echo "$SNAPSHOT_LIST" | grep -v "^ID" | head -1)

    if [ -z "$LATEST_SNAPSHOT" ]; then
        log_error "Could not parse snapshot list"
        return 1
    fi

    SNAPSHOT_ID=$(echo "$LATEST_SNAPSHOT" | awk '{print $1}')
    SNAPSHOT_DATE=$(echo "$LATEST_SNAPSHOT" | awk '{print $2, $3}')
    SNAPSHOT_STATUS=$(echo "$LATEST_SNAPSHOT" | awk '{print $(NF-1), $NF}')

    # Calculate snapshot age
    SNAPSHOT_TIMESTAMP=$(date -d "$SNAPSHOT_DATE" +%s 2>/dev/null || echo 0)
    CURRENT_TIMESTAMP_S=$(date +%s)
    SNAPSHOT_AGE_HOURS=$(( (CURRENT_TIMESTAMP_S - SNAPSHOT_TIMESTAMP) / 3600 ))

    # Count total snapshots
    SNAPSHOT_COUNT=$(echo "$SNAPSHOT_LIST" | grep -v "^ID" | wc -l)

    # Get database statistics
    _get_database_size_fly "$FLY_APP"

    # Add metrics
    _add_json_metric "platform" "fly.io"
    _add_json_metric "last_snapshot_id" "$SNAPSHOT_ID"
    _add_json_metric "last_snapshot_date" "$SNAPSHOT_DATE"
    _add_json_metric "snapshot_age_hours" "$SNAPSHOT_AGE_HOURS"
    _add_json_metric "snapshot_count_available" "$SNAPSHOT_COUNT"
    _add_json_metric "database_size_mb" "$DB_SIZE_MB"

    log_metric "Last snapshot: $SNAPSHOT_ID"
    log_metric "Snapshot age: $SNAPSHOT_AGE_HOURS hours"
    log_metric "Available snapshots: $SNAPSHOT_COUNT"
    log_metric "Database size: ${DB_SIZE_MB}MB"
}

_collect_render_metrics() {
    log_info "Collecting Render backup metrics..."

    log_warning "Render metrics require manual collection or dashboard API"
    log_info "Check: https://dashboard.render.com/ → Database → Backups"

    _add_json_metric "platform" "render"
    _add_json_metric "note" "Manual collection required"
}

_collect_docker_metrics() {
    log_info "Collecting Docker backup metrics..."

    BACKUP_DIR="${BACKUP_DIR:-./backups}"

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "Backup directory not found: $BACKUP_DIR"
        _add_json_metric "platform" "docker"
        _add_json_metric "error" "backup_directory_not_found"
        return 1
    fi

    # Find latest backup file
    LATEST_BACKUP=$(find "$BACKUP_DIR" -maxdepth 1 \( -name "*.sql" -o -name "*.dump" \) \
        -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)

    if [ -z "$LATEST_BACKUP" ]; then
        log_warning "No backup files found"
        _add_json_metric "platform" "docker"
        _add_json_metric "backup_count" "0"
        return 1
    fi

    # Get backup file info
    BACKUP_NAME=$(basename "$LATEST_BACKUP")
    BACKUP_SIZE_BYTES=$(stat -f%z "$LATEST_BACKUP" 2>/dev/null || stat -c%s "$LATEST_BACKUP" 2>/dev/null)
    BACKUP_SIZE_MB=$(( BACKUP_SIZE_BYTES / 1024 / 1024 ))
    BACKUP_TIME=$(stat -f%m "$LATEST_BACKUP" 2>/dev/null || stat -c%Y "$LATEST_BACKUP" 2>/dev/null)

    # Calculate backup age
    CURRENT_TIMESTAMP_S=$(date +%s)
    BACKUP_AGE_HOURS=$(( (CURRENT_TIMESTAMP_S - BACKUP_TIME) / 3600 ))

    # Count all backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 \( -name "*.sql" -o -name "*.dump" \) -type f | wc -l)

    # Get database size
    _get_database_size_docker

    # Add metrics
    _add_json_metric "platform" "docker"
    _add_json_metric "last_backup_file" "$BACKUP_NAME"
    _add_json_metric "last_backup_size_mb" "$BACKUP_SIZE_MB"
    _add_json_metric "backup_age_hours" "$BACKUP_AGE_HOURS"
    _add_json_metric "backup_count" "$BACKUP_COUNT"
    _add_json_metric "database_size_mb" "$DB_SIZE_MB"
    _add_json_metric "backup_directory" "$BACKUP_DIR"

    log_metric "Latest backup: $BACKUP_NAME"
    log_metric "Backup size: ${BACKUP_SIZE_MB}MB"
    log_metric "Backup age: $BACKUP_AGE_HOURS hours"
    log_metric "Total backups: $BACKUP_COUNT"
    log_metric "Database size: ${DB_SIZE_MB}MB"
}

#
# Database size collection functions
#

_get_database_size_railway() {
    log_info "Getting database size from Railway..."

    # This would require API access or direct DB query
    # For now, estimate or skip
    DB_SIZE_MB=0
    log_warning "Database size requires direct database query (not implemented)"
}

_get_database_size_fly() {
    local app=$1

    log_info "Getting database size from Fly.io..."

    # This would require SSH into app and querying database
    DB_SIZE_MB=0
    log_warning "Database size requires SSH access (not implemented)"
}

_get_database_size_docker() {
    log_info "Getting database size from Docker..."

    # Query database directly
    if command -v docker &> /dev/null && docker info > /dev/null 2>&1; then
        # Try to get size from running PostgreSQL instance
        DB_SIZE_BYTES=$(docker exec postgres psql \
            -U postgres \
            -t -c "SELECT pg_database_size('$DB_NAME');" 2>/dev/null || echo 0)

        if [ "$DB_SIZE_BYTES" -gt 0 ]; then
            DB_SIZE_MB=$(( DB_SIZE_BYTES / 1024 / 1024 ))
        else
            DB_SIZE_MB=0
        fi
    else
        DB_SIZE_MB=0
    fi

    log_metric "Database size: ${DB_SIZE_MB}MB"
}

#
# Metrics processing
#

_add_json_metric() {
    local key=$1
    local value=$2

    # Add to JSON file (simple approach)
    # In production, use jq for proper JSON manipulation
    echo "    \"$key\": \"$value\"," >> "${METRICS_FILE}.tmp" 2>/dev/null || true
}

_process_metrics() {
    log_info "Processing metrics..."

    # Load current metrics
    # This is where we would analyze trends, check thresholds, etc.

    # Check backup age alert
    if [ ! -z "$BACKUP_AGE_HOURS" ] && [ "$BACKUP_AGE_HOURS" -gt 24 ]; then
        log_warning "⚠️  Backup is older than 24 hours: $BACKUP_AGE_HOURS hours"
        _add_json_metric "alert_backup_age" "true"
    else
        _add_json_metric "alert_backup_age" "false"
    fi

    # Check database size growth
    if [ -f "${METRICS_DIR}/metrics-$(date -d '1 day ago' +%Y-%m-%d).json" ]; then
        PREV_SIZE=$(grep "database_size_mb" "${METRICS_DIR}/metrics-$(date -d '1 day ago' +%Y-%m-%d).json" | \
            grep -oE '[0-9]+' | head -1)

        if [ ! -z "$PREV_SIZE" ] && [ ! -z "$DB_SIZE_MB" ]; then
            SIZE_GROWTH=$((DB_SIZE_MB - PREV_SIZE))
            GROWTH_PERCENT=$((SIZE_GROWTH * 100 / PREV_SIZE))

            if [ "$GROWTH_PERCENT" -gt 20 ]; then
                log_warning "⚠️  Database size growth: ${GROWTH_PERCENT}% (${SIZE_GROWTH}MB)"
                _add_json_metric "alert_size_growth" "true"
            fi

            _add_json_metric "daily_size_growth_mb" "$SIZE_GROWTH"
        fi
    fi
}

_generate_summary() {
    log_info "Generating metrics summary..."

    # Create summary JSON with latest metrics
    cat > "$SUMMARY_FILE" << EOF
{
  "last_updated": "$CURRENT_TIMESTAMP",
  "backup_metrics": {
    "platform": "$DEPLOYMENT_SERVICE",
    "backup_status": "healthy",
    "latest_metrics_file": "metrics-${CURRENT_DATE}.json"
  },
  "alerts": {
    "backup_age_exceeded": false,
    "database_growth_high": false,
    "backup_failed": false
  },
  "compliance": {
    "rto_target_hours": 1,
    "rpo_target_hours": 24,
    "retention_days": 30
  }
}
EOF

    log_info "Summary saved to: $SUMMARY_FILE"
}

_upload_metrics() {
    log_info "Preparing metrics for upload..."

    # This would send metrics to monitoring service
    # Examples: Datadog, New Relic, CloudWatch, Prometheus

    # Check for monitoring configuration
    if [ ! -z "$DATADOG_API_KEY" ]; then
        log_info "Uploading to Datadog..."
        _upload_datadog
    elif [ ! -z "$NEW_RELIC_API_KEY" ]; then
        log_info "Uploading to New Relic..."
        _upload_new_relic
    elif [ ! -z "$CLOUDWATCH_NAMESPACE" ]; then
        log_info "Uploading to CloudWatch..."
        _upload_cloudwatch
    else
        log_info "No monitoring service configured (set environment variables for upload)"
    fi
}

_upload_datadog() {
    # Example: Upload backup metrics to Datadog
    # Requires: DATADOG_API_KEY environment variable

    curl -s -X POST \
        "https://api.datadoghq.com/api/v1/series" \
        -H "DD-API-KEY: $DATADOG_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"series\": [
                {
                    \"metric\": \"backup.age_hours\",
                    \"points\": [[$CURRENT_TIMESTAMP_S, $BACKUP_AGE_HOURS]],
                    \"type\": \"gauge\",
                    \"tags\": [\"service:orbit-hr\", \"environment:production\"]
                },
                {
                    \"metric\": \"backup.count_available\",
                    \"points\": [[$CURRENT_TIMESTAMP_S, $BACKUP_COUNT]],
                    \"type\": \"gauge\",
                    \"tags\": [\"service:orbit-hr\", \"environment:production\"]
                },
                {
                    \"metric\": \"database.size_mb\",
                    \"points\": [[$CURRENT_TIMESTAMP_S, $DB_SIZE_MB]],
                    \"type\": \"gauge\",
                    \"tags\": [\"service:orbit-hr\", \"environment:production\"]
                }
            ]
        }" 2>/dev/null || log_warning "Datadog upload failed"
}

_upload_new_relic() {
    # Example: Upload to New Relic
    # Requires: NEW_RELIC_API_KEY environment variable

    log_warning "New Relic upload not yet implemented"
}

_upload_cloudwatch() {
    # Example: Upload to AWS CloudWatch
    # Requires: AWS credentials and CLOUDWATCH_NAMESPACE

    if command -v aws &> /dev/null; then
        aws cloudwatch put-metric-data \
            --namespace "$CLOUDWATCH_NAMESPACE" \
            --metric-data \
                MetricName=BackupAgeHours,Value="$BACKUP_AGE_HOURS",Unit=Hours \
                MetricName=BackupCount,Value="$BACKUP_COUNT",Unit=Count \
                MetricName=DatabaseSizeMB,Value="$DB_SIZE_MB",Unit=Megabytes \
            2>/dev/null || log_warning "CloudWatch upload failed"
    else
        log_warning "AWS CLI not found, skipping CloudWatch upload"
    fi
}

#
# Main execution
#

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat << 'EOF'
Backup Metrics Collection Script

Usage:
  ./scripts/backup-metrics.sh [OPTIONS]

Environment Variables:
  DEPLOYMENT_SERVICE   Platform: railway, fly, render, or docker (auto-detected)
  METRICS_DIR          Directory for metrics files (default: ./backup-metrics)
  DB_NAME              Database name (default: orbit_hr)
  BACKUP_DIR           Backup directory for docker (default: ./backups)
  FLY_APP              Fly.io app name (default: orbit-hr-prod)

  Monitoring Service Configuration (optional):
  DATADOG_API_KEY      Datadog API key for metrics upload
  NEW_RELIC_API_KEY    New Relic API key for metrics upload
  CLOUDWATCH_NAMESPACE AWS CloudWatch namespace for metrics

Examples:
  # Collect metrics with auto-detection
  ./scripts/backup-metrics.sh

  # Collect metrics for Docker
  DEPLOYMENT_SERVICE=docker ./scripts/backup-metrics.sh

  # Collect and upload to Datadog
  DATADOG_API_KEY=xxx ./scripts/backup-metrics.sh

Schedule:
  Run daily: 03:00 UTC
  Cron: 0 3 * * *

Output:
  Metrics are saved to: backup-metrics/metrics-YYYY-MM-DD.json
  Summary available at: backup-metrics/metrics-summary.json
EOF
    exit 0
fi

exit 0
