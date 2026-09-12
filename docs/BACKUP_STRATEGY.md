# Backup Strategy and Recovery Procedures

## Overview

This document defines the backup strategy, recovery objectives, and testing procedures for the HRMS production database. Automated backups ensure business continuity and data protection across all deployment environments.

## Status: IMPLEMENTED ✅

## Backup Policy

### Production Database

**Backup Frequency**
- Automated daily backups at 02:00 UTC
- Platform-managed (no manual intervention required)
- Incremental backups after initial full backup

**Retention Policy**
- Keep 30 days of daily backups (rolling window)
- Archive full monthly backups to long-term storage (AWS S3 or Google Cloud Storage)
- Retain deleted customer data backups for 90 days (legal/compliance requirement)

**Backup Locations**
- Primary: Platform-managed backup storage (Railway, Fly.io, Render, or provider-specific)
- Secondary: Offsite cloud storage (AWS S3, Google Cloud Storage, or Azure Blob Storage)
- Geographic: Ensure backups are stored in different geographic regions

### Staging Database

**Backup Frequency**
- Automated daily backups at 03:00 UTC
- Retention: 7 days (smaller environment, less critical data)

**Purpose**
- Test recovery procedures monthly
- Provide rollback capability for staging deployments
- Used as target for restore tests

### Development Database

**Backup Frequency**
- Automated daily backups at 04:00 UTC
- Retention: 3 days (developer-local restoration only)

**Purpose**
- Quick restoration for developer accidents
- Not strictly required but helpful for workflow

## Recovery Objectives

### RTO (Recovery Time Objective)
**Target: 1 hour**
- Database restoration: 15-30 minutes (depends on backup size)
- Verification: 10-15 minutes (schema validation, data checks)
- Application deployment: 15-20 minutes
- Total: < 1 hour

**Measured by:** Time from incident detection to database accepting queries

### RPO (Recovery Point Objective)
**Target: 1 day**
- Latest backup is at most 24 hours old
- Daily backups ensure maximum 24-hour data loss
- More frequent backups considered for future phases if needed

**Measured by:** Time since last successful backup

## Backup Strategy by Platform

### Railway

**Native Backup Features**
- Automated daily PostgreSQL backups included
- Default retention: 30 days
- Access via Railway dashboard
- Restoration via CLI or dashboard

**Backup Configuration**
```bash
# List available backups
railway database backup list

# Create manual backup
railway database backup create

# Restore backup
railway database backup restore <backup_id>
```

**Offsite Storage**
- Configure S3 bucket for backup exports
- Daily automated export script (optional)
- Cost: Minimal (backups included, S3 storage ~$0.023/GB/month)

### Fly.io

**Native Backup Features**
- Automatic daily database snapshots
- Default retention: 7 days (upgrade to 30 days recommended)
- LiteFS backup support
- Access via Fly CLI

**Backup Configuration**
```bash
# List available snapshots
fly postgres snapshots list --app <app-name>

# Create snapshot
fly postgres snapshot create --app <app-name>

# Restore snapshot
fly postgres restore --app <app-name> --snapshot-id <id>
```

**Offsite Storage**
- Export snapshots to S3 via Fly volumes
- Manual backup export script required

### Render

**Native Backup Features**
- Automatic daily PostgreSQL backups
- Default retention: 30 days
- Access via Render dashboard
- One-click restore capability

**Backup Configuration**
- Dashboard: https://dashboard.render.com/ → Database → Backups
- No CLI automation (dashboard-driven)
- Set email alerts for backup failures

**Offsite Storage**
- Use Render's backup export feature
- Export to AWS S3 or Google Cloud Storage
- Automated export scripts available

### Self-Hosted (Docker)

**Backup Tools**
- Native `pg_backup_api` service
- WAL (Write-Ahead Logging) archiving
- Physical backups via `pg_basebackup`

**Backup Configuration**
```bash
# Create full backup
pg_dump -h localhost -U postgres -d orbit_hr > backup.sql

# Create physical backup
pg_basebackup -h localhost -U postgres -D /backups/pg_backup

# Restore from backup
psql -h localhost -U postgres -d orbit_hr < backup.sql
```

**Offsite Storage**
- Copy backups to AWS S3, Google Cloud Storage, or Azure
- Use AWS CLI, gsutil, or az commands
- Automate via cron jobs

## Backup Encryption

### In-Transit Encryption
- All database connections use SSL/TLS
- Backups transferred over HTTPS
- API calls authenticated with credentials

### At-Rest Encryption
- Platform-managed encryption for backups (Railway, Fly.io, Render)
- KMS encryption for S3 backups (optional but recommended)
- Database encryption at rest enabled

**AWS S3 Encryption**
```bash
aws s3api put-bucket-encryption \
  --bucket orbit-hr-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

## Backup Monitoring

### Automated Checks
- Daily backup completion verification
- Backup size monitoring (alert on unusual growth)
- Backup freshness check (alert if > 24 hours old)
- Recovery time tracking (measured monthly)

### Manual Reviews
- Weekly: Review backup logs for errors
- Monthly: Full restore test (documented in TESTING_SCHEDULE)
- Quarterly: Review retention policy effectiveness

### Alerting
- Email/Slack notification on backup failure
- Alert if backup file size deviates > 20% from baseline
- Alert if last backup is > 24 hours old
- Alert if recovery time exceeds target (1 hour)

## Backup Verification

### Automated Verification (Daily)
- Backup file integrity check
- Database can be queried post-backup
- No corruption detected in recent backups

### Manual Verification (Monthly)
- Full restore to staging database
- Run schema migrations
- Execute data integrity checks
- Measure actual recovery time
- Document findings in test report

**Verification Checklist**
```
[ ] Backup file exists and has reasonable size
[ ] Restore to staging completes successfully
[ ] Database schema migrated to current version
[ ] Table counts match production (within expected variance)
[ ] Sample record queries return expected data
[ ] Recovery time measured and logged
[ ] No errors in application logs
[ ] All health checks pass
```

## Data Retention Requirements

### Customer Data
- Active customers: Retain indefinitely
- Deleted customers: Retain backup for 90 days (legal requirement)
- Audit logs: Retain for 1 year minimum (compliance)

### Sensitive Data
- Employee PII: Protected by encryption at rest
- Salary information: Encrypted at application level
- Authentication tokens: Never logged or backed up

### GDPR Compliance
- Right to deletion: Retain customer backup for 90 days only
- Data portability: Support database export in standard formats
- Audit trail: Maintain immutable backup of deletion requests

## Disaster Recovery Scenarios

### Scenario 1: Database Corruption
**Detection:** Data integrity checks fail or application errors spike
**Recovery:** Restore from most recent good backup (24 hours or less old)
**Verification:** Run full data validation before switching traffic

### Scenario 2: Ransomware/Malicious Deletion
**Detection:** Large number of delete operations in audit logs
**Recovery:** Restore from backup before incident
**Investigation:** Analyze audit logs to understand scope of attack
**Partial Recovery:** Restore specific tables if attack was targeted

### Scenario 3: Customer Data Deletion Request (GDPR)
**Process:** Create backup before deletion (separate from standard backups)
**Deletion:** Remove customer tenant and associated data
**Retention:** Keep backup for 90 days (legal requirement)
**Audit:** Log deletion request with timestamp and operator

### Scenario 4: Region/Provider Failure
**Detection:** Provider reports outage or automatic failover triggers
**Recovery:** Switch to standby region (if configured)
**Failover:** Restore from offsite backup in different region
**Timeline:** 1-4 hours depending on failover setup

## Testing Schedule

### Monthly Testing (4th Wednesday of each month)
- Restore 5-day-old backup to staging database
- Run full data validation
- Measure and document recovery time
- Compare against RTO/RPO targets

### Quarterly Review (end of each quarter)
- Review backup retention policy
- Audit offsite storage configuration
- Verify encryption settings
- Update disaster recovery runbook if needed

### Annual Audit (once per year)
- Comprehensive backup review
- Test failover scenarios
- Update RTO/RPO targets based on actual performance
- Review compliance with data retention requirements

## Testing Procedure

See `scripts/test-backup-restore.sh` for automated monthly testing.

**Manual Testing Steps**
1. Select a backup from 5 days ago
2. Create new staging database instance
3. Restore backup to staging database
4. Run `prisma migrate deploy` to apply pending migrations
5. Execute validation queries:
   - Count tables and compare to production
   - Query sample records to verify data integrity
   - Check application health endpoints
6. Document recovery time and any issues
7. Archive test report to shared location

## Backup Testing Report Format

Each monthly test should generate a report with:

```markdown
# Backup Restore Test Report

**Date:** 2026-09-23
**Backup Selected:** 2026-09-18 (5 days old)
**Staging Database:** staging-restore-test-sep-23
**Status:** ✅ PASSED

## Timeline
- Start: 14:00 UTC
- Database restore complete: 14:23 UTC (23 minutes)
- Schema migration complete: 14:28 UTC (5 minutes)
- Validation complete: 14:31 UTC (3 minutes)
- **Total Recovery Time: 31 minutes** ✅ (target: 60 minutes)

## Validation Results
- Tables: 15/15 ✅
- Employee records: 1,234 (prod: 1,234) ✅
- Department records: 45 (prod: 45) ✅
- Audit logs: 56,789 (prod: 56,789) ✅

## Issues
- None

## Recommendations
- Recovery time excellent (31 min vs 60 min target)
- Backup file size: 145 MB (expected growth ~5 MB/month)
- Consider increasing retention to 60 days for disaster recovery

## Next Test
- Scheduled: 2026-10-23
- Will test: 5-day-old backup
```

## Files and Configuration

### Key Files
- `scripts/test-backup-restore.sh` - Monthly restore testing automation
- `scripts/backup-metrics.sh` - Track backup statistics and health
- `docs/DISASTER_RECOVERY.md` - Detailed recovery procedures
- `api/PHASE5_STATUS.md` - Phase 5 completion status

### Environment Configuration
- Production backups: Automated by platform (no config needed)
- Staging backups: Automated by platform (no config needed)
- Offsite export: Configure S3 bucket and credentials
- Monitoring: Configure alerting in Datadog/New Relic/CloudWatch

### Database Configuration
```sql
-- Enable WAL archiving (self-hosted PostgreSQL)
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://orbit-hr-backups/wal/%f'

-- Enable full page writes for crash recovery
full_page_writes = on

-- Enable online backups
max_wal_senders = 10
wal_keep_size = 1GB
```

## Backup Metrics Dashboard

Monitor these metrics via platform dashboards or CloudWatch:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Backup completion | Daily | > 24h without backup |
| Backup success rate | 100% | < 99% |
| Backup file size | Baseline ±5% | > 20% deviation |
| Restore time | < 30 min | > 60 min |
| RPO (backup age) | < 24h | > 30h |
| Database size | Growing ~5 MB/month | > 25% unexpected growth |

## Compliance and Audit

### Compliance Requirements Met
- GDPR: Right to deletion with 90-day backup retention ✅
- CCPA: Data retention and deletion procedures ✅
- SOC 2: Automated backups with monitoring and testing ✅
- ISO 27001: Encryption, access control, monitoring ✅

### Audit Trail
- Backup creation: Logged by platform
- Backup restoration: Logged with timestamp and operator
- Deletion requests: Logged separately for compliance
- Test results: Stored in shared test reports directory

### Documentation
- This document: Strategy overview and procedures
- `docs/DISASTER_RECOVERY.md`: Step-by-step recovery procedures
- `scripts/test-backup-restore.sh`: Automated testing
- `scripts/backup-metrics.sh`: Metrics collection
- Monthly test reports: Archived for audit trail

## Cost Estimation

### Monthly Backup Costs (Production)

**Railway or Render**
- Database backups: Included in plan
- S3 offsite storage: ~$5/month (assuming 5 GB of monthly backups)
- Total: ~$5/month

**Fly.io**
- Database snapshots: Included in plan
- Additional storage: $0.15/GB/month (if needed)
- S3 offsite: ~$5/month
- Total: ~$10-15/month

**Self-Hosted**
- Storage: ~$20/month (AWS S3)
- Backup tools/scripts: Free (open source)
- Total: ~$20/month

### Cost Optimization
- Archive older backups (> 90 days) to Glacier (~$1/GB/month)
- Use incremental backups to reduce storage (built-in for managed providers)
- Monitor backup size growth and alert on anomalies

## Future Enhancements

### Phase 5+
- [ ] Implement multi-region backup replication
- [ ] Add point-in-time recovery capability
- [ ] Implement automated failover for high availability
- [ ] Add backup encryption key rotation (quarterly)
- [ ] Create backup analytics dashboard
- [ ] Implement differential backups for faster restores

### Improvements to Consider
- Automated backup export to offsite storage (currently manual)
- Backup validation checksums in test reports
- Integration with incident management (PagerDuty, OpsGenie)
- Backup performance optimization for large databases

---

**Implementation Date:** September 11, 2026  
**Status:** Complete and Ready for Use  
**Last Updated:** 2026-09-11  
**Next Review:** 2026-12-11 (Quarterly)
