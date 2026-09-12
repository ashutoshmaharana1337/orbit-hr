# Disaster Recovery Runbook

## Quick Reference

**Call list (update in CONTACTS.md):**
- On-call Engineer: [phone/email]
- Engineering Lead: [phone/email]
- Database Admin: [phone/email]
- VP Engineering: [phone/email]

**Critical URLs:**
- Platform Dashboard: [production platform]
- Database Backups: [backup location]
- Slack channel: #incident-response
- Status page: [status page URL]

**Important Credentials:**
- Database credentials: In platform secret manager
- Backup access: In platform secret manager
- AWS S3 access: In platform secret manager

---

## Disaster Scenarios and Recovery Procedures

### Scenario 1: Database Corrupted or Data Integrity Issue

**Symptoms:**
- Application returns database errors (500 errors)
- Specific tables show unusual data
- Data validation checks fail
- Anomalous query performance

**Detection (Automated)**
- Health check endpoint returns error
- Database integrity check fails
- Application monitoring alerts on error rate spike

**Severity Assessment**
- **Critical:** Entire database unusable (RON 15 minutes)
- **High:** Specific tables corrupted (RTO 1 hour)
- **Medium:** Data inconsistency (RTO 4 hours)

**Recovery Procedure**

**Step 1: Immediate Containment (0-5 min)**
```bash
# 1. Assess the scope
# - Which tables are affected?
# - How many records?
# - Is application still partially functional?

# 2. Check application logs for errors
# Platform dashboard → Logs → Filter by "ERROR" or "FATAL"

# 3. If critical corruption detected:
#    - Disable API traffic (set maintenance mode)
#    - Notify on-call lead
#    - Post to #incident-response

# 4. Identify last good backup
# Railway: railway database backup list
# Fly.io: fly postgres snapshots list --app APPNAME
# Render: Dashboard → Database → Backups
# Docker: ls -lah /backups/
```

**Step 2: Select Recovery Target (5-10 min)**
```bash
# 1. Review available backups
#    - Daily backups for last 30 days available
#    - Look for 1-day-old or older backup

# 2. Verify backup integrity
#    - Check backup file size (should be typical)
#    - Verify backup was successful (status = "completed")

# 3. Select backup (usually previous day's)
#    - Example: If today is Sept 15, select Sept 14 backup
#    - Avoid backups taken during peak usage

# 4. Note backup ID and timestamp
BACKUP_ID="backup_2026-09-14_02-00"
BACKUP_TIME="2026-09-14 02:00 UTC"
```

**Step 3: Create Restoration Environment (10-25 min)**
```bash
# 1. Create new staging database (separate from existing staging)
#    This ensures we don't destroy existing staging data

# Railway
railway database create orbit_hr_restore

# Fly.io (create new app)
fly apps create orbit-hr-restore-prod
fly postgres attach --app orbit-hr-restore-prod

# Render
# Via dashboard: Database → Create PostgreSQL

# Docker (create separate container)
docker run --name postgres-restore \
  -e POSTGRES_PASSWORD=restore_password \
  -e POSTGRES_DB=orbit_hr \
  -v /backups/restore:/var/lib/postgresql/data \
  -d postgres:16-alpine

# 2. Note connection details for restoration
DB_HOST="..."
DB_USER="..."
DB_PASSWORD="..."
DB_NAME="orbit_hr_restore"
```

**Step 4: Restore Backup to Staging (25-50 min)**
```bash
# 1. Restore backup from selected backup ID

# Railway
railway database backup restore --id $BACKUP_ID

# Fly.io
fly postgres restore --app orbit-hr-restore-prod \
  --backup-id $BACKUP_ID

# Render
# Via dashboard: Database → Backups → Restore to new database

# Docker/Self-hosted
pg_restore \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  /backups/${BACKUP_ID}.sql

# 2. Monitor restore progress
#    - This typically takes 15-30 minutes
#    - Check platform dashboard for progress
#    - Don't interrupt even if slow

# 3. Wait for completion confirmation
#    - Platform shows "Backup restored successfully"
#    - Database accepts connections
```

**Step 5: Apply Schema Migrations (50-55 min)**
```bash
# 1. Connect to restored database
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"

# 2. Apply any pending migrations to current version
cd api
npx prisma migrate deploy

# 3. Check for migration errors
#    - Should show "All migrations have been applied"
#    - If errors: investigate and resolve before continuing

# 4. Verify Prisma client
npx prisma generate
```

**Step 6: Validate Data Integrity (55-65 min)**
```bash
# 1. Connect to restored database
npm run db:console  # or psql connection

# 2. Run validation queries
# Count all tables
SELECT schemaname, COUNT(*) as count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname;

# Count specific important tables
SELECT COUNT(*) as employee_count FROM "Employee";
SELECT COUNT(*) as department_count FROM "Department";
SELECT COUNT(*) as payroll_count FROM "Payroll";

# Check for recent data
SELECT MAX(created_at) as last_record FROM "Employee";
SELECT COUNT(*) as audit_count FROM "AuditLog" 
  WHERE created_at > NOW() - INTERVAL '24 hours';

# Verify no orphaned records
SELECT * FROM "Department" WHERE id NOT IN (
  SELECT DISTINCT department_id FROM "Employee"
) LIMIT 10;

# 3. Compare with production
#    - Table counts should match (within expected variance)
#    - No data should be missing from 24 hours ago
#    - Sample records should look correct

# 4. Run application health checks
curl https://api.production.com/api/health
curl https://api.production.com/api/ready
# Both should return 200 OK
```

**Step 7: Application Verification (65-75 min)**
```bash
# 1. Deploy test version pointing to restored database
#    - Don't use production yet
#    - Use dedicated test/restore environment

# 2. Run application tests against restored database
npm run test:e2e --database=restore

# 3. Check application logs
#    - Should see normal startup logs
#    - No errors or warnings
#    - All health checks passing

# 4. Manual smoke tests
#    - Login with test credentials
#    - View employee records
#    - Generate report
#    - Check payroll calculations
```

**Step 8: Traffic Switchover (75-90 min)**
```bash
# 1. Final verification checklist
[ ] Restore database fully functional
[ ] All migrations applied successfully
[ ] Data validation checks passed
[ ] Application tests passed
[ ] Health checks responding normally
[ ] No errors in application logs

# 2. If critical incident: immediate switchover
#    - Update production DATABASE_URL env var to restored database
#    - For managed platforms: in dashboard, update environment
#    - For self-hosted: update docker-compose.yml and restart

# Railway
railway environment add DATABASE_URL "postgresql://..."

# Fly.io
fly secrets set DATABASE_URL="postgresql://..."
fly deploy

# Render
# Via dashboard: Environment → DATABASE_URL → update value

# Docker
docker-compose down
docker-compose up -d

# 3. Monitor application
#    - Check logs for connection success
#    - Verify health checks passing
#    - Monitor error rate and response times

# 4. Keep old database for 24 hours
#    - DO NOT delete old database immediately
#    - Keep for audit trail and potential rollback
#    - Delete after 24-hour observation period
```

**Step 9: Post-Incident Cleanup (after switchover stable)**
```bash
# 1. Archive incident details
#    - Backup ID used
#    - Time of incident and detection
#    - Time of recovery
#    - Root cause (if identified)

# 2. Delete temporary restoration database (after 24 hours)
#    - Keep for at least 24 hours
#    - Allows quick rollback if issues found
#    - Platform will handle cleanup or manual deletion

# Railway
railway database delete orbit_hr_restore

# Fly.io
fly apps destroy orbit-hr-restore-prod

# Render
# Via dashboard: Database → Delete

# Docker
docker-compose down -v

# 3. Delete old corrupted database (after 24 hours)
#    - Only if restoration proved successful
#    - Archive final backup of corrupted DB for investigation

# 4. Run post-incident review
#    - What caused the corruption?
#    - How can we prevent this in future?
#    - Update procedures based on learnings
```

**Estimated Timeline: 90 minutes**

---

### Scenario 2: Ransomware, Malicious Deletion, or Security Breach

**Symptoms:**
- Large number of DELETE operations in audit logs
- User reports data missing
- Security team alerts on suspicious activity
- Database size drops dramatically

**Detection (Automated)**
- Audit log triggers alert (> 1000 deletes/minute)
- Database space usage alerts drop
- Data validation fails

**Severity Assessment**
- **Critical:** Widespread deletion affecting core data (RON immediate)
- **High:** Targeted deletion (specific tables/customers) (RTO 1 hour)
- **Medium:** Suspicious activity in logs, no visible impact yet (RTO 4 hours)

**Recovery Procedure**

**Step 1: Immediate Containment (0-10 min)**
```bash
# 1. Isolate production immediately
#    - Disable API traffic (set 503 Service Unavailable)
#    - Disable all write operations
#    - Allow reads only (or none) to prevent data contamination

# 2. Disable database user credentials that might be compromised
#    - Change production database password
#    - Revoke suspicious user sessions
#    - Reset API authentication tokens

# 3. Enable read-only mode
#    Production API stops accepting write requests

# 4. Notify security team and leadership
#    - Email: security@company.com, engineering-leads@
#    - Slack: #incident-response, #security
#    - Include: discovery time, scope of potential impact

# 5. Document incident timeline
#    - Time of discovery
#    - First sign of compromise
#    - Current status of systems

# Example: Disable writes in app
#    - All POST/PUT/PATCH/DELETE → 503 "Database in read-only mode"
#    - GET requests still work (allow information access)
```

**Step 2: Investigation (10-30 min, parallel with recovery)**
```bash
# 1. Analyze audit logs for suspicious activity
SELECT * FROM "AuditLog" 
WHERE action = 'DELETE'
ORDER BY created_at DESC
LIMIT 1000;

# 2. Identify scope of deletion
#    - Which tables affected?
#    - Which users deleted data?
#    - Time range of suspicious activity?

# 3. Search for data exfiltration signs
#    - Unusual API access patterns
#    - Large data exports
#    - Credential compromise indicators

# 4. Preserve evidence
#    - Download full audit logs
#    - Backup current corrupted database
#    - Archive access logs from API and infrastructure

# 5. Engage security team
#    - Provide investigation findings
#    - Request security incident classification
#    - Determine if external notification required (GDPR/CCPA)
```

**Step 3: Recovery Decision (30-40 min)**
```bash
# 1. Determine recovery strategy based on scope

# Option A: Full database restore (widespread deletion)
#    - Restore from backup before incident
#    - Accept data loss from last 24 hours
#    - Proceed with Scenario 1 (database corruption recovery)

# Option B: Targeted table restore (specific tables affected)
#    - Restore only affected tables from backup
#    - Merge with current data from unaffected tables
#    - More complex but preserves newer data in other tables

# Option C: Point-in-time recovery (if available)
#    - Some platforms support PITR to specific timestamp
#    - Restore database state to before deletion occurred
#    - Seamless recovery with minimal data loss

# 2. Make recovery decision with leadership
#    - For widespread: Use Option A (full restore)
#    - For targeted: Use Option B (table restore)
#    - If available: Use Option C (PITR)

# 3. Determine timeline impact
#    - Full restore: 1-2 hours
#    - Table restore: 2-4 hours
#    - PITR: 30 minutes - 1 hour
```

**Step 4: Execute Recovery (as per selected option)**

**Option A: Full Restore (use Scenario 1 steps)**
```bash
# Follow Scenario 1 (Database Corrupted) procedures
# Recovery time: ~90 minutes
# Data loss: Last 24 hours (acceptable for security incident)
```

**Option B: Targeted Table Restore (advanced procedure)**
```bash
# 1. Identify affected tables from investigation
AFFECTED_TABLES=("Employee" "Payroll" "Department")

# 2. Create separate database with backup
#    - Follow Scenario 1 steps to restore full backup
#    - Keep production database still in read-only mode

# 3. Export affected tables from backup
for table in "${AFFECTED_TABLES[@]}"; do
  pg_dump -h backup_host -U user orbit_hr \
    --table=$table > /tmp/${table}.sql
done

# 4. Import tables into production
#    - Drop current affected tables
#    - Import from backup
#    - Verify data integrity

for table in "${AFFECTED_TABLES[@]}"; do
  psql -h prod_host -U user orbit_hr < /tmp/${table}.sql
done

# 5. Verify reconciliation
#    - Check unaffected tables still have new data
#    - Verify affected tables restored correctly
#    - Run data validation checks
```

**Option C: Point-in-Time Recovery (if platform supports)**
```bash
# 1. Identify timestamp before deletion occurred
#    - Check audit logs for deletion start time
#    - Select timestamp 1 hour before first deletion

# 2. Restore to that timestamp
# Railway: Not currently supported
# Fly.io: fly postgres restore --backup-id pitr --timestamp "2026-09-11T10:00:00Z"
# Render: Limited PITR support (24-48 hours)

# 3. Verify recovery
#    - All deleted data should be present
#    - System state matches pre-incident
```

**Step 5: Post-Recovery Security Actions (after recovery confirmed)**
```bash
# 1. Credential rotation (HIGH PRIORITY)
#    - Rotate all database passwords
#    - Reset all API authentication tokens
#    - Rotate service account credentials
#    - Rotate secrets in secret manager

# 2. Access control audit
#    - Review who has database access
#    - Review API keys and their permissions
#    - Implement principle of least privilege

# 3. Enable additional monitoring
#    - Alert on unusual delete rates
#    - Monitor failed login attempts
#    - Track credential changes

# 4. Consider additional security measures
#    - Enable database audit logging
#    - Implement database activity monitoring (DAM)
#    - Add VPN/IP whitelist for database access

# 5. Temporary read-only replica (optional)
#    - Create read-only copy of database
#    - Use for reports and analytics
#    - Protects primary from accidental deletes
```

**Estimated Timeline: 90-180 minutes (depending on option)**

---

### Scenario 3: Unplanned Customer Data Deletion (GDPR Right to Deletion)

**Trigger:**
- Customer requests data deletion under GDPR Article 17
- Legal team approves deletion request
- Customer data must be permanently deleted

**Process Overview**
- Create backup before deletion (separate from standard backups)
- Delete customer's tenant and all associated data
- Verify deletion completed
- Retain backup for 90 days (legal requirement)
- Archive audit log of deletion

**Procedure**

**Step 1: Preparation (before deletion)**
```bash
# 1. Legal verification
#    - Confirm written request from customer
#    - Verify deletion is required and not just requested
#    - Check for any legal holds or pending litigation

# 2. Identify customer data scope
#    - Which tables contain customer data?
#    - Which records belong to this customer?
#    - Are there associated audit logs?

# Example query for customer: ID = 123
SELECT * FROM "Tenant" WHERE id = 123;

SELECT * FROM "Employee" 
WHERE tenant_id = 123;

SELECT * FROM "Payroll" 
WHERE employee_id IN (
  SELECT id FROM "Employee" WHERE tenant_id = 123
);
```

**Step 2: Pre-Deletion Backup (5-10 min)**
```bash
# 1. Create manual backup snapshot
#    - Used as insurance in case deletion fails
#    - Retained for 90 days per legal requirement
#    - Not part of standard daily backups

# Railway
railway database backup create \
  --label "gdpr_deletion_customer_123_2026-09-11"

# Fly.io
fly postgres snapshot create --app production \
  --name "gdpr_deletion_customer_123"

# Render
# Manual backup via dashboard with label

# Docker
pg_dump -h localhost -U postgres orbit_hr \
  > /backups/pre_deletion_customer_123_2026-09-11.sql

# 2. Archive backup location
#    - Note backup ID and location
#    - Store in separate compliance storage
#    - Ensure retention for 90 days
```

**Step 3: Data Deletion (10-20 min)**
```bash
# 1. Connect to production database
export DATABASE_URL="[production database connection]"

# 2. Document deletion request
#    - Customer ID
#    - Deletion timestamp
#    - Operator performing deletion
#    - Legal approval reference

# 3. Delete customer tenant and associated data
#    Option A: Application-level deletion (preferred)
DELETE FROM "Employee" WHERE tenant_id = 123;
DELETE FROM "Department" WHERE tenant_id = 123;
DELETE FROM "Tenant" WHERE id = 123;
-- Application handles cascade deletes

#    Option B: Direct SQL deletion (if app not available)
BEGIN TRANSACTION;

-- Delete in dependency order
DELETE FROM "Payroll" 
WHERE employee_id IN (
  SELECT id FROM "Employee" WHERE tenant_id = 123
);

DELETE FROM "EmployeeHistory" 
WHERE employee_id IN (
  SELECT id FROM "Employee" WHERE tenant_id = 123
);

DELETE FROM "Employee" WHERE tenant_id = 123;
DELETE FROM "Department" WHERE tenant_id = 123;
DELETE FROM "Tenant" WHERE id = 123;

COMMIT;

# 4. Verify deletion
SELECT COUNT(*) FROM "Tenant" WHERE id = 123;  -- Should be 0
SELECT COUNT(*) FROM "Employee" WHERE tenant_id = 123;  -- Should be 0
```

**Step 4: Audit Logging**
```bash
# 1. Create deletion record in audit log
INSERT INTO "AuditLog" (
  action, entity_type, entity_id, change_details, 
  created_at, created_by, reason
) VALUES (
  'DELETE',
  'Tenant',
  '123',
  '{"type": "GDPR_Right_to_Deletion", "customer_name": "Acme Corp"}',
  NOW(),
  'legal-team',
  'GDPR Article 17 request - Customer ID 123'
);

# 2. Archive audit log entry
#    - Immutable record for compliance
#    - Retained per data retention policy (1 year)
#    - Include deletion approval reference

# 3. Generate deletion certificate
#    - Confirm deletion date and time
#    - List of deleted data categories
#    - Reference to legal approval
#    - Send to customer for their records
```

**Step 5: Verification and Follow-up (5 min)**
```bash
# 1. Final verification
SELECT COUNT(*) FROM "Tenant" WHERE id = 123;
SELECT COUNT(*) FROM "Employee" WHERE tenant_id = 123;
SELECT COUNT(*) FROM "Payroll" WHERE deleted_at IS NULL 
  AND employee_id IN (SELECT id FROM "Employee" 
    WHERE tenant_id = 123);

# 2. Notify customer
#    - Confirm deletion completed
#    - Provide deletion timestamp and reference number
#    - Offer data export of any final data if needed

# 3. Internal documentation
#    - Log deletion in compliance system
#    - Update DPIA (Data Protection Impact Assessment) if needed
#    - Schedule backup destruction after 90 days

# 4. Schedule backup destruction
#    - Set reminder for 2026-12-11 (90 days later)
#    - Confirm deletion was successful before destroying
#    - Document backup deletion in audit log
```

**Estimated Timeline: 30 minutes**

---

### Scenario 4: Complete Production Outage / Region Failure

**Symptoms:**
- Database completely unreachable
- Provider reports region/data center failure
- All connections timeout
- Health checks fail completely

**Detection (Automated)**
- Health check endpoint fails all retries
- Database connection pool exhausted
- Provider status page shows outage

**Severity Assessment**
- **CRITICAL:** Complete outage affecting all users (RON < 5 minutes)

**Failover Procedure**

**Step 1: Immediate Assessment (0-5 min)**
```bash
# 1. Check provider status page
#    - Railway: https://status.railway.app
#    - Fly.io: https://status.fly.io
#    - Render: https://status.render.com

# 2. Attempt database connection from multiple locations
#    - From CI/CD server
#    - From local machine
#    - From staging environment

# 3. Verify it's not a local network issue
#    - Check firewall rules
#    - Verify VPN connection
#    - Try from different network

# 4. If provider outage confirmed:
#    - Post incident to status page
#    - Notify customers of degraded service
#    - Begin failover to standby region
```

**Step 2: Activate Standby (if configured, 10-30 min)**
```bash
# Prerequisites: Must have configured multi-region setup
# If NOT configured: Skip to Step 3

# 1. Verify standby database is healthy
DATABASE_URL="[standby database]"
psql $DATABASE_URL -c "SELECT 1;"

# 2. Update DNS/routing to standby region
#    - Platform provides DNS update instructions
#    - Update connection string in all services
#    - Clear DNS cache: sudo systemctl restart systemd-resolved

# 3. Verify application can connect to standby
#    - Update DATABASE_URL in production environment
#    - Restart application containers
#    - Check application logs for connection success

# 4. Run health checks
curl https://api.production.com/api/health
curl https://api.production.com/api/ready
# Both should return 200 after 2-3 minute delay

# 5. Monitor for data consistency
#    - Check for replication lag
#    - Verify no data loss
#    - Monitor error rates
```

**Step 3: Fallback to Backup Restore (if no standby, 90+ min)**
```bash
# 1. If primary region unavailable AND no standby:
#    - This is last resort recovery
#    - Expect 90-120 minute recovery time
#    - Data loss of up to 24 hours

# 2. Create new production database in different region
#    Example: Primary was us-east, create in us-west

# Railway (create in different region)
railway environment create us-west
railway database create orbit_hr --region us-west

# Fly.io (deploy app in different region)
fly regions set waw sfo  # Example: Warsaw, San Francisco
fly postgres attach -a orbit-hr-prod

# Render (manual: create new service in different region)

# 3. Restore latest offsite backup to new region
#    - Select most recent S3 backup
#    - Restore to new database

aws s3 cp s3://orbit-hr-backups/latest_backup.sql ./
psql -h new_database_host orbit_hr < latest_backup.sql

# 4. Point application to new database
#    - Update DATABASE_URL environment variable
#    - Restart application services
#    - Monitor for successful connection

# 5. Verify data integrity
#    - Follow Scenario 1 validation steps
#    - Check table counts and key records
#    - Run application health checks

# 6. Update DNS records
#    - Point api.production.com to new region IP
#    - Update web app backend URL
#    - Monitor DNS propagation
```

**Step 4: Communication (ongoing during outage)**
```bash
# 1. Initial notification (within 5 min)
#    Channel: status page, customer email, Slack
#    Message: "We're experiencing a database connectivity issue 
#             and investigating. We'll provide updates every 15 minutes."

# 2. Update every 15 minutes
#    - Current status
#    - Estimated time to recovery
#    - Impact to customers

# 3. Resolution notification
#    - Service restored and stable
#    - Root cause (brief)
#    - Estimated data loss (if any)
#    - Link to post-mortem (after completion)

# Example status page update
"[15:30 UTC] Database failure detected in primary region.
Initiating failover to standby region. ETA: 15 minutes.
Customers may experience degraded performance."
```

**Step 5: Post-Incident Recovery (after service restored)**
```bash
# 1. Stabilization period (1-4 hours)
#    - Monitor error rates
#    - Check application performance
#    - Verify no cascading failures

# 2. Post-mortem (same day)
#    - What caused the outage?
#    - How was recovery triggered?
#    - What can we improve?

# 3. Prevention measures
#    - Implement multi-region replication
#    - Add automated failover
#    - Improve monitoring and alerting

# 4. Runbook updates
#    - Document what worked
#    - Update timelines
#    - Add lessons learned
```

**Estimated Timeline: 10-30 min (with failover) or 90+ min (with restore)**

---

## General Recovery Steps

### Pre-Incident Preparation

**Before any incident happens:**

1. **Test recovery procedures monthly**
   ```bash
   # Run full restore test (4th Wednesday of each month)
   ./scripts/test-backup-restore.sh
   ```

2. **Update contact list**
   - Keep CONTACTS.md current with phone numbers
   - Include on-call rotation schedule
   - Include escalation contacts

3. **Verify backup access**
   - Monthly: Confirm can list backups from platform
   - Test restore to staging database
   - Verify credentials are current

4. **Document your environment**
   - Database connection strings
   - Platform credentials locations
   - Backup storage locations
   - Alternative DNS/routing options

5. **Practice the procedures**
   - Run quarterly failover drills
   - Time the procedures
   - Update estimated recovery times

### During Any Incident

1. **Stay calm and methodical**
   - Follow the runbook step-by-step
   - Don't skip steps (even if they seem fast)
   - Document what you're doing

2. **Communicate constantly**
   - Update team in Slack every 15 minutes
   - Post status page updates
   - Answer customer inquiries

3. **Verify before each step**
   - Check database connections
   - Verify data integrity
   - Test application functionality

4. **Document everything**
   - Note exact times
   - Record errors and how resolved
   - Keep chat logs for post-mortem

5. **Escalate when stuck**
   - Don't debug forever alone
   - Call in additional team members
   - Request vendor support if needed

### After Incident

1. **Conduct post-mortem**
   - Timeline: What happened when?
   - Root cause: Why did it happen?
   - Impact: How many customers affected? How long?
   - Resolution: What fixed it?
   - Prevention: How do we prevent this?

2. **Update procedures**
   - Did timelines match actual recovery?
   - Were steps correct?
   - Missing steps or outdated commands?
   - Update this runbook

3. **Share learnings**
   - Team meeting to discuss
   - Update monitoring/alerting based on learnings
   - Share with other teams

4. **Implement improvements**
   - Add monitoring for root cause
   - Improve automation where possible
   - Schedule multi-region setup if time permits

---

## Key Tools and Commands Reference

### Database Connections

**PostgreSQL CLI**
```bash
# Connect to database
psql postgresql://user:password@host:5432/dbname

# Execute query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Employee\";"

# Execute from file
psql $DATABASE_URL < validation.sql
```

### Platform Commands

**Railway**
```bash
# List databases
railway database list

# Backup operations
railway database backup list
railway database backup create
railway database backup restore --id BACKUP_ID

# Environment operations
railway environment list
railway environment create
railway environment delete
```

**Fly.io**
```bash
# Login
flyctl auth login

# App operations
flyctl apps list
flyctl status --app APP_NAME

# PostgreSQL operations
fly postgres list --app APP_NAME
fly postgres snapshots list --app APP_NAME
fly postgres snapshot create --app APP_NAME
fly postgres restore --app APP_NAME --snapshot-id ID

# Environment variables
flyctl secrets list --app APP_NAME
flyctl secrets set DATABASE_URL="..." --app APP_NAME
flyctl deploy --app APP_NAME
```

**Render**
```bash
# Access via dashboard
https://dashboard.render.com/

# Database backups (dashboard only, no CLI)
# Navigate: Database → Backups → Restore
```

### AWS CLI (for S3 backups)
```bash
# List backups in S3
aws s3 ls s3://orbit-hr-backups/

# Download backup
aws s3 cp s3://orbit-hr-backups/backup.sql ./backup.sql

# Upload backup
aws s3 cp backup.sql s3://orbit-hr-backups/

# Delete old backup
aws s3 rm s3://orbit-hr-backups/old_backup.sql
```

---

## Incident Command System (ICS)

For major incidents, follow this structure:

**Incident Commander (IC)**
- Overall incident leadership
- Makes critical decisions
- Communicates with stakeholders
- Calls post-mortem

**Technical Lead**
- Leads recovery execution
- Recommends technical actions
- Works with IC on decisions

**Communications Lead**
- Updates status page
- Answers customer questions
- Sends internal notifications

**Documentation Lead**
- Records timeline
- Captures decisions
- Takes screenshots/logs
- Prepares post-mortem

---

## Contacts

**To be updated in CONTACTS.md:**
- On-call Engineer: [phone/email]
- Engineering Lead: [phone/email]
- Database Admin: [phone/email]
- VP Engineering: [phone/email]
- Security Team: [email]
- Customer Support Lead: [phone/email]
- AWS Account Owner: [contact]

---

## Appendix: Related Documentation

- `docs/BACKUP_STRATEGY.md` - Backup strategy and retention policy
- `scripts/test-backup-restore.sh` - Monthly backup testing
- `scripts/backup-metrics.sh` - Backup monitoring and metrics
- `api/PHASE5_STATUS.md` - Phase 5 implementation status

---

**Last Updated:** 2026-09-11  
**Review Schedule:** Quarterly (next: 2026-12-11)  
**Tested:** Annually (next: 2026-09-11)
