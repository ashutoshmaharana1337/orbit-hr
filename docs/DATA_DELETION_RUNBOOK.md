# Customer Data Deletion Runbook

**Last Updated**: September 11, 2026

## 1. Purpose and Scope

This runbook provides step-by-step procedures for when a customer requests complete deletion of their organization's data from HRMS. This includes all employee records, attendance data, leave data, and organizational settings.

### 1.1 When to Use This Runbook

Use this runbook when:
- Customer requests complete deletion of company/organization data
- Customer account is being terminated and cleanup is required
- GDPR Article 17 (right to be forgotten) deletion is requested
- CCPA deletion request from organization representative
- Data subject deletion for specific employee (use simpler procedure)

**Do NOT use for:**
- Single employee deletion (use standard termination process)
- Deletion of historical data (use Data Retention Policy)
- Deletion for compliance purposes (use purging schedule)
- Restoration of accidentally deleted data

### 1.2 Key Principles

- **Verification Required**: Verify request authenticity through legal/compliance
- **Backups Critical**: Create backups for dispute resolution
- **Audit Trail**: Document every step for compliance
- **Data Retention**: Maintain backup for 90 days per policy
- **Legal Holds**: Check for active legal holds before deletion

---

## 2. Pre-Deletion Checklist

### 2.1 Verify Request Authenticity

**Step 1: Receive Request**
```
Request received from: [Customer Contact Name]
Request date: [Date]
Organization: [Company Name]
Requested by: [Title/Role]
Contact email: [Email]
Contact phone: [Phone]
Reason for deletion: [Brief description]
```

**Step 2: Verify Identity**
- [ ] Contact person is verified employee of organization
- [ ] Contact person has authorization (CEO, Legal, Compliance)
- [ ] Get written confirmation if requested verbally
- [ ] Email confirmation sent and acknowledged

**Step 3: Legal Review**
- [ ] Forward request to Legal team
- [ ] Check for active litigation involving customer data
- [ ] Check for pending investigations
- [ ] Check for regulatory holds
- [ ] Get legal sign-off to proceed
- [ ] Document legal review date and conclusion

**Step 4: Compliance Review**
- [ ] Check for active support issues
- [ ] Check for ongoing audits
- [ ] Check for payment disputes
- [ ] Verify no data subject objections
- [ ] Get compliance approval to proceed

**Approval Required:**
```
Legal Approval: _______________  Date: _______
Compliance Approval: __________  Date: _______
Executive Approval: ___________  Date: _______
```

### 2.2 Data Assessment

**Step 1: Identify Data Scope**

Query to assess data volume:

```sql
-- Identify organization
SELECT id, name, slug FROM tenants WHERE slug = 'customer-slug';

-- Count employee records
SELECT COUNT(*) as employee_count FROM employees WHERE tenant_id = 'tenant_id';

-- Count attendance records
SELECT COUNT(*) as attendance_count FROM attendance WHERE tenant_id = 'tenant_id';

-- Count leave records
SELECT COUNT(*) as leave_count FROM leave_requests WHERE tenant_id = 'tenant_id';

-- Count audit logs
SELECT COUNT(*) as audit_count FROM audit_logs WHERE tenant_id = 'tenant_id';

-- Total data size
SELECT pg_size_pretty(pg_total_relation_size('employees')) as emp_size,
       pg_size_pretty(pg_total_relation_size('attendance')) as att_size,
       pg_size_pretty(pg_total_relation_size('leave_requests')) as leave_size;
```

**Record Results:**
```
Organization: [Name]
Tenant ID: [UUID]
Total Employees: [Number]
Active Employees: [Number]
Total Attendance Records: [Number]
Total Leave Records: [Number]
Total Audit Logs: [Number]
Estimated Total Size: [GB]
```

**Step 2: Check for Legal Holds**

```sql
-- Check for active legal holds
SELECT * FROM legal_holds WHERE tenant_id = 'tenant_id' AND released_at IS NULL;

-- Check for related disputes
SELECT * FROM disputes WHERE tenant_id = 'tenant_id' AND status != 'resolved';

-- Check for ongoing litigation
SELECT * FROM litigation WHERE tenant_id = 'tenant_id' AND status = 'active';
```

**Result:**
- [ ] No legal holds found - Safe to delete
- [ ] Legal holds found - STOP, escalate to legal team
- [ ] Holds being reviewed - Wait for legal decision

**Step 3: Identify Related Records**

```sql
-- Find all related data tables
SELECT DISTINCT table_name FROM information_schema.columns 
WHERE column_name = 'tenant_id';

-- For each related table, count records
-- Example:
SELECT 'departments' as table_name, COUNT(*) as record_count FROM departments WHERE tenant_id = 'tenant_id'
UNION ALL
SELECT 'leave_balances', COUNT(*) FROM leave_balances WHERE tenant_id = 'tenant_id'
UNION ALL
SELECT 'leave_policies', COUNT(*) FROM leave_policies WHERE tenant_id = 'tenant_id';
```

**Assessment Complete - Proceed to Backup Phase**

---

## 3. Backup and Export Phase

### 3.1 Create Backup

**Step 1: Initiate Full Backup**

```bash
#!/bin/bash

TENANT_ID="tenant-uuid-here"
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_NAME="org-deletion-${TENANT_ID}-${BACKUP_DATE}"

# Dump tenant data
pg_dump \
  --host=$DB_HOST \
  --username=$DB_USER \
  --password \
  --format=custom \
  --file=/backups/${BACKUP_NAME}.dump \
  --exclude-table-data="public.audit_logs" \
  $DATABASE

# Create backup metadata
cat > /backups/${BACKUP_NAME}.metadata <<EOF
{
  "tenant_id": "${TENANT_ID}",
  "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reason": "Customer data deletion request",
  "retention_until": "$(date -u -d '+90 days' +%Y-%m-%d)",
  "created_by": "$USER"
}
EOF

# Verify backup integrity
pg_restore \
  --list /backups/${BACKUP_NAME}.dump > /backups/${BACKUP_NAME}.contents

echo "Backup created: ${BACKUP_NAME}"
```

**Record:**
```
Backup Name: [Name]
Backup Date: [Date and Time]
Backup Size: [Size in GB]
Backup Location: [Path or Storage]
Backup Verification: [PASSED/FAILED]
Retention Until: [90 days from now]
```

**Step 2: Verify Backup Integrity**

```bash
# Test restoration in non-production environment
pg_restore \
  --host=$STAGING_DB_HOST \
  --username=$DB_USER \
  --password \
  --create \
  /backups/${BACKUP_NAME}.dump

# Verify all tables restored
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public';

# Spot check data
SELECT COUNT(*) FROM employees WHERE tenant_id = 'tenant_id';
```

**Verification Result:**
- [ ] Backup successfully restored
- [ ] All tables present
- [ ] Data integrity verified
- [ ] Row counts match original

### 3.2 Create Customer Export (Optional)

If customer requests copy of their data:

```bash
# Export to customer-friendly format (CSV)
psql -h $DB_HOST -U $DB_USER -d $DATABASE <<EOF > /exports/customer-export-${TENANT_ID}.csv

-- Export all employee data
\COPY (
  SELECT * FROM employees WHERE tenant_id = 'tenant_id'
) TO STDOUT WITH CSV HEADER
EOF

# Export to JSON (for programmatic use)
psql -h $DB_HOST -U $DB_USER -d $DATABASE -t -A -F, \
  "SELECT row_to_json(t) FROM employees t WHERE tenant_id = 'tenant_id'" \
  > /exports/customer-export-${TENANT_ID}.json

# Encrypt export for delivery
gpg --armor --encrypt \
  --recipient $CUSTOMER_GPG_KEY \
  /exports/customer-export-${TENANT_ID}.csv

# Deliver to customer securely
# (e.g., password-protected download link, email, secure transfer)
```

**Delivery Record:**
```
Export Date: [Date]
Export Format: [CSV/JSON]
Encryption: [Method]
Delivery Method: [Secure link/Email/Transfer]
Delivery Confirmation: [Received by customer]
```

---

## 4. Pre-Deletion Verification

### 4.1 Final Approval

**Checklist Before Deletion:**
- [ ] Legal review completed and approved
- [ ] Compliance review completed and approved
- [ ] Executive approval obtained
- [ ] Backup successfully created and verified
- [ ] Customer export completed (if requested)
- [ ] No legal holds in place
- [ ] All stakeholders notified
- [ ] Scheduled maintenance window confirmed

**Final Authorization:**

```
Request Verified By: _______________  Date: _______
Data Backup Verified By: ____________ Date: _______
Legal Approves: ____________________  Date: _______
Executive Approves: ________________  Date: _______

APPROVED TO PROCEED WITH DELETION: YES / NO
```

### 4.2 Communication to Customer

**Email Template:**

```
Subject: Confirmation - Data Deletion Scheduled [Organization Name]

Dear [Contact Name],

This is to confirm that we have received your request to delete all data 
for [Organization Name] from our HRMS system.

DELETION DETAILS:
- Organization: [Name]
- Total Records: [Count]
- Scheduled Deletion Date: [Date and Time]
- Estimated Completion Time: [Duration]
- Your Backup Retention: 90 days

WHAT WILL BE DELETED:
✓ Employee records (50 employees)
✓ Attendance records (1200 entries)
✓ Leave records (45 entries)
✓ Organizational settings
✓ Custom fields and data
✓ System usage logs (anonymized)

WHAT WILL BE RETAINED (for legal compliance):
- Backup copies (90 days)
- Billing records (7 years)
- Audit logs (anonymized, indefinitely)

NEXT STEPS:
1. We have created a backup of your data
2. Deletion will occur on [Date] at [Time] UTC
3. You will receive confirmation within 24 hours
4. Your backup will be retained for 90 days if you need recovery

If you have any questions or wish to cancel, please contact us immediately.

Best regards,
HRMS Data Compliance Team
```

- [ ] Confirmation email sent
- [ ] Customer acknowledged

---

## 5. Deletion Phase

### 5.1 Production Deletion (PRE-DELETION CHECKLIST)

**CRITICAL: Do NOT proceed without all checkboxes:**
- [ ] All approvals obtained
- [ ] Backup verified and tested
- [ ] Maintenance window confirmed (low traffic time)
- [ ] Support team notified
- [ ] Rollback plan reviewed
- [ ] Team members standing by

### 5.2 Execute Deletion

**Step 1: Mark Tenant as Deleted**

```sql
BEGIN TRANSACTION;

-- Mark tenant as deleted
UPDATE tenants 
SET deleted_at = NOW(),
    deleted_by = 'data-deletion-service',
    deletion_reason = 'Customer requested data deletion'
WHERE id = 'tenant_id';

-- Record deletion event
INSERT INTO deletion_events (
  tenant_id, event_type, event_date, 
  deleted_record_count, status, created_by
) VALUES (
  'tenant_id',
  'FULL_TENANT_DELETION',
  NOW(),
  0,
  'IN_PROGRESS',
  'system'
);

COMMIT;
```

**Step 2: Delete Employee Data**

```sql
BEGIN TRANSACTION;

-- Get employee count for logging
CREATE TEMP TABLE emp_to_delete AS
SELECT id FROM employees WHERE tenant_id = 'tenant_id';

-- Anonymize and then delete
UPDATE employees 
SET name = 'Deleted Employee',
    email = 'deleted_' || encode(digest(id::text, 'sha256'), 'hex') || '@internal',
    phone = NULL,
    personal_email = NULL,
    home_address = NULL,
    home_city = NULL,
    home_state = NULL,
    home_postal_code = NULL,
    home_country = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    emergency_contact_relationship = NULL
WHERE tenant_id = 'tenant_id';

-- Delete employees
DELETE FROM employees WHERE tenant_id = 'tenant_id';

-- Get count for logging
SELECT COUNT(*) INTO emp_count FROM emp_to_delete;

-- Log deletion
INSERT INTO deletion_events 
  (tenant_id, event_type, record_type, record_count, status)
VALUES 
  ('tenant_id', 'EMPLOYEE_DELETION', 'employees', emp_count, 'COMPLETED');

COMMIT;
```

**Step 3: Delete Attendance Records**

```sql
BEGIN TRANSACTION;

-- Count attendance records
CREATE TEMP TABLE att_to_delete AS
SELECT id FROM attendance WHERE tenant_id = 'tenant_id';

-- Delete attendance
DELETE FROM attendance WHERE tenant_id = 'tenant_id';

-- Log deletion
SELECT COUNT(*) INTO att_count FROM att_to_delete;
INSERT INTO deletion_events 
  (tenant_id, event_type, record_type, record_count, status)
VALUES 
  ('tenant_id', 'ATTENDANCE_DELETION', 'attendance', att_count, 'COMPLETED');

COMMIT;
```

**Step 4: Delete Leave Records**

```sql
BEGIN TRANSACTION;

-- Delete leave requests
DELETE FROM leave_requests WHERE tenant_id = 'tenant_id';

-- Delete leave balances
DELETE FROM leave_balances WHERE tenant_id = 'tenant_id';

-- Delete leave policies
DELETE FROM leave_policies WHERE tenant_id = 'tenant_id';

-- Delete leave types
DELETE FROM leave_types WHERE tenant_id = 'tenant_id';

-- Log deletion
INSERT INTO deletion_events 
  (tenant_id, event_type, record_type, record_count, status)
VALUES 
  ('tenant_id', 'LEAVE_DELETION', 'leave_*', 
   (SELECT SUM(record_count) FROM deletion_events WHERE tenant_id = 'tenant_id' AND record_type LIKE 'leave_%'),
   'COMPLETED');

COMMIT;
```

**Step 5: Delete Organizational Data**

```sql
BEGIN TRANSACTION;

-- Delete departments
DELETE FROM departments WHERE tenant_id = 'tenant_id';

-- Delete leave policies
DELETE FROM leave_policies WHERE tenant_id = 'tenant_id';

-- Delete tenant configurations
DELETE FROM tenant_settings WHERE tenant_id = 'tenant_id';

-- Delete custom fields
DELETE FROM custom_fields WHERE tenant_id = 'tenant_id';

-- Log deletion
INSERT INTO deletion_events 
  (tenant_id, event_type, record_type, status)
VALUES 
  ('tenant_id', 'CONFIG_DELETION', 'departments,settings,custom_fields', 'COMPLETED');

COMMIT;
```

**Step 6: Anonymize Audit Logs**

```sql
BEGIN TRANSACTION;

-- Anonymize user references in audit logs
UPDATE audit_logs 
SET user_name = 'Deleted User',
    user_email = NULL,
    user_id = NULL
WHERE tenant_id = 'tenant_id';

-- Remove PII from action details (if stored)
UPDATE audit_logs 
SET action_details = jsonb_set(
  action_details, 
  '{employee_name}', 
  '"Deleted Employee"'::jsonb
)
WHERE tenant_id = 'tenant_id' 
  AND action_details ? 'employee_name';

-- Keep audit logs for compliance, but mark as deleted
UPDATE audit_logs 
SET archived = true,
    archived_at = NOW()
WHERE tenant_id = 'tenant_id';

COMMIT;
```

**Step 7: Delete API Keys and Sessions**

```sql
BEGIN TRANSACTION;

-- Delete all API keys for tenant
DELETE FROM api_keys WHERE tenant_id = 'tenant_id';

-- Invalidate all user sessions
DELETE FROM user_sessions WHERE tenant_id = 'tenant_id';

-- Revoke all refresh tokens
DELETE FROM refresh_tokens WHERE tenant_id = 'tenant_id';

COMMIT;
```

**Step 8: Update Deletion Status**

```sql
UPDATE deletion_events 
SET status = 'COMPLETED',
    completed_at = NOW()
WHERE tenant_id = 'tenant_id' 
  AND event_type = 'FULL_TENANT_DELETION';
```

### 5.3 Verify Deletion in Production

```sql
-- Verify deletion completeness
SELECT tenant_id, COUNT(*) as remaining_records
FROM (
  SELECT tenant_id FROM employees WHERE tenant_id = 'tenant_id'
  UNION ALL
  SELECT tenant_id FROM attendance WHERE tenant_id = 'tenant_id'
  UNION ALL
  SELECT tenant_id FROM leave_requests WHERE tenant_id = 'tenant_id'
) AS remaining
GROUP BY tenant_id;

-- Should return: 0 rows

-- Verify tenant marked as deleted
SELECT id, deleted_at, deletion_reason 
FROM tenants WHERE id = 'tenant_id';

-- Verify audit logs archived
SELECT COUNT(*) as archived_count 
FROM audit_logs 
WHERE tenant_id = 'tenant_id' AND archived = true;

-- Log deletion completion
INSERT INTO deletion_log (tenant_id, deletion_date, status, verified_by)
VALUES ('tenant_id', NOW(), 'VERIFIED', 'deletion-service');
```

**Verification Checklist:**
- [ ] No employee records found
- [ ] No attendance records found
- [ ] No leave records found
- [ ] No configuration records found
- [ ] Tenant marked as deleted with timestamp
- [ ] Audit logs archived (not deleted)
- [ ] All API keys deleted
- [ ] All sessions invalidated

---

## 6. Post-Deletion Phase

### 6.1 Backup Retention and Archival

**Backup Archive Schedule:**

```
Deletion Date: [Date]
Backup Retention Period: 90 days
Archive Expiration Date: [90 days from deletion]

Timeline:
- Day 0-30: Hot storage (immediately restorable)
- Day 30-90: Cold storage (archive, 4-24 hour restore)
- Day 90: Permanently delete from all backups
```

**Backup Management:**

```bash
#!/bin/bash

BACKUP_ARCHIVE="/backups/deletion-archive"
TENANT_ID="tenant-id-here"
BACKUP_NAME="org-deletion-${TENANT_ID}-${BACKUP_DATE}"

# Move backup to archive tier
mv /backups/${BACKUP_NAME}.dump ${BACKUP_ARCHIVE}/${BACKUP_NAME}.dump

# Encrypt for archival
gpg --armor --encrypt --symmetric \
  ${BACKUP_ARCHIVE}/${BACKUP_NAME}.dump

# Delete unencrypted copy
rm ${BACKUP_ARCHIVE}/${BACKUP_NAME}.dump

# Set retention date
touch -t "$(date -d '+90 days' +%Y%m%d%H%M)" \
  ${BACKUP_ARCHIVE}/${BACKUP_NAME}.dump.gpg

# Log in archive manifest
echo "${TENANT_ID}|${BACKUP_DATE}|$(date -d '+90 days' +%Y-%m-%d)" \
  >> ${BACKUP_ARCHIVE}/manifest.txt
```

**Record:**
```
Backup Archive Location: [Path]
Backup Encryption: [Method]
Archive Expiration Date: [Date]
Responsibility: [IT/Security team]
Backup Contents:
  - Tables: [List]
  - Records: [Count]
  - Size: [GB]
  - Checksum: [Hash]
```

### 6.2 Verify Deletion in Staging

**Restore Backup to Staging for Verification:**

```bash
# Restore backup to staging database
pg_restore \
  --host=$STAGING_DB_HOST \
  --username=$DB_USER \
  --password \
  --create \
  /backups/deletion-archive/${BACKUP_NAME}.dump

# Connect to restored database and verify data is present
psql -h $STAGING_DB_HOST -U $DB_USER <<EOF

-- Verify backup contains the expected data
SELECT COUNT(*) as employee_count FROM employees WHERE tenant_id = 'tenant_id';
SELECT COUNT(*) as attendance_count FROM attendance WHERE tenant_id = 'tenant_id';

-- Verify anonymization was NOT applied to backup (backup is clean copy)
SELECT COUNT(*) FROM employees 
WHERE tenant_id = 'tenant_id' AND name = 'Deleted Employee';

-- Should return 0 (backup should have original names)

EOF
```

**Staging Verification:**
- [ ] Backup restored successfully
- [ ] Original data present in backup
- [ ] Data count matches pre-deletion count
- [ ] No anonymization in backup
- [ ] Restore time documented
- [ ] Cleanup staging database

### 6.3 Compliance Documentation

**Create Deletion Certificate:**

```
═══════════════════════════════════════════════════════════════
                    DATA DELETION CERTIFICATE
═══════════════════════════════════════════════════════════════

Organization: [Name]
Tenant ID: [UUID]
Deletion Request Date: [Date]
Deletion Execution Date: [Date and Time]
Deletion Completed Date: [Date and Time]

DELETION SUMMARY:
─────────────────────────────────────────────────────────────
Records Deleted:
  - Employees: [Count]
  - Attendance Records: [Count]
  - Leave Records: [Count]
  - Configurations: [Count]
  - API Keys: [Count]
  - Sessions: [Count]
Total Records Deleted: [Count]

DATA RETENTION:
─────────────────────────────────────────────────────────────
Backup Retention: 90 days ([Date] - [Date])
Backup Location: [Secure Archive]
Backup Encryption: AES-256 + GPG
Audit Logs Retained: Yes (Anonymized)
Billing Records Retained: 7 years (Tax Compliance)

AUTHORIZED BY:
─────────────────────────────────────────────────────────────
Requested by: [Name/Title]
Legal Approval: [Name/Signature]         Date: [Date]
Compliance Approval: [Name/Signature]    Date: [Date]
Executed by: [System/User]               Date: [Date]
Verified by: [Name/Role]                 Date: [Date]

═══════════════════════════════════════════════════════════════

This certificate verifies that all personal data for [Organization Name]
has been permanently deleted from HRMS production systems as of [Date].

Data recovery is possible from backup until [Date], after which all
backups will be permanently destroyed.

For questions, contact: privacy@company.com

═══════════════════════════════════════════════════════════════
```

**Compliance Logging:**

```sql
-- Insert into compliance log
INSERT INTO compliance_deletions (
  tenant_id,
  organization_name,
  deletion_date,
  records_deleted,
  backup_retention_until,
  requested_by,
  legal_approved_by,
  compliance_approved_by,
  executed_by,
  certificate_generated
) VALUES (
  'tenant_id',
  'Organization Name',
  NOW(),
  [total_count],
  NOW() + INTERVAL '90 days',
  '[Requester Name]',
  '[Legal Name]',
  '[Compliance Name]',
  'deletion-service',
  true
);
```

### 6.4 Notify Customer of Completion

**Email Template:**

```
Subject: Data Deletion Complete - [Organization Name] ✓

Dear [Contact Name],

We are writing to confirm that the complete deletion of all data for 
[Organization Name] from our HRMS system has been successfully completed.

DELETION COMPLETION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Deletion Request Date: [Date]
Deletion Completion Date: [Date and Time]
Status: ✓ COMPLETED AND VERIFIED

WHAT WAS DELETED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 50 Employee Records
✓ 1,200 Attendance Records
✓ 45 Leave Records
✓ All Organizational Settings
✓ All Custom Fields and Data
✓ All API Keys and Sessions
✓ System Usage Logs (Anonymized)

TOTAL RECORDS DELETED: [Count]

DATA BACKUP & RECOVERY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Backup Location: Secure Archive Storage
- Backup Encryption: AES-256 Encrypted
- Backup Retention Period: 90 Days
- Backup Expiration: [Date]
- Recovery Option: Available if dispute raised within 90 days

PERMANENT RECORDS RETAINED (Legal Requirement):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Billing Records: Retained for 7 years (Tax Law)
- Audit Logs: Retained indefinitely (Anonymized, Compliance)

DOCUMENTATION PROVIDED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Data Deletion Certificate (attached)
✓ Deletion Summary Report (attached)
✓ Backup Verification Report (attached)

If you have any questions or need to verify the deletion, please don't
hesitate to contact us.

Best regards,
HRMS Data Compliance Team
privacy@company.com
```

- [ ] Completion email sent
- [ ] Certificates attached
- [ ] Customer acknowledged receipt

### 6.5 Final Audit Log Entry

```sql
-- Create final comprehensive deletion record
INSERT INTO deletion_audit_log (
  tenant_id,
  deletion_type,
  deletion_date,
  request_date,
  approval_date,
  execution_date,
  completion_date,
  total_records_deleted,
  backup_location,
  backup_retention_until,
  audit_logs_archived,
  legal_hold_status,
  certificate_issued,
  customer_notified,
  status,
  notes
) VALUES (
  'tenant_id',
  'FULL_ORGANIZATIONAL_DELETION',
  NOW(),
  '[request_date]',
  '[approval_date]',
  '[execution_date]',
  NOW(),
  [total_records],
  '[backup_location]',
  NOW() + INTERVAL '90 days',
  true,
  'None',
  true,
  true,
  'COMPLETED_AND_VERIFIED',
  'Customer data deletion completed per GDPR/CCPA requirements'
);
```

---

## 7. Dispute Resolution & Recovery (Within 90 Days)

### 7.1 Dispute Raised

If customer claims deletion was unauthorized:

**Step 1: Receive Dispute**
- [ ] Date dispute received
- [ ] Contact person submitting dispute
- [ ] Reason for dispute
- [ ] Documentation provided

**Step 2: Verify Authorization**

```sql
-- Check original deletion request
SELECT * FROM deletion_requests 
WHERE tenant_id = 'tenant_id' 
ORDER BY created_at DESC LIMIT 1;

-- Check approvals
SELECT * FROM deletion_approvals 
WHERE tenant_id = 'tenant_id';

-- Check authorization records
SELECT * FROM compliance_deletions 
WHERE tenant_id = 'tenant_id';
```

**Step 3: Validate Dispute**

If dispute valid and within 90-day window:

```bash
# Check if backup still exists
ls -la /backups/deletion-archive/org-deletion-${TENANT_ID}-*.dump.gpg

# If exists and within 90 days, prepare restoration
```

### 7.2 Data Restoration

**If Authorized to Restore:**

```bash
#!/bin/bash

BACKUP_FILE="/backups/deletion-archive/org-deletion-${TENANT_ID}-${BACKUP_DATE}.dump.gpg"

# Decrypt backup
gpg --output backup.dump --decrypt ${BACKUP_FILE}

# Restore to production
pg_restore \
  --host=$DB_HOST \
  --username=$DB_USER \
  --password \
  --clean \
  backup.dump

# Verify restoration
psql -h $DB_HOST -U $DB_USER -d $DATABASE -c \
  "SELECT COUNT(*) FROM employees WHERE tenant_id = 'tenant_id';"

# Update tenant status
psql -h $DB_HOST -U $DB_USER -d $DATABASE -c \
  "UPDATE tenants SET deleted_at = NULL WHERE id = 'tenant_id';"
```

**Record Restoration:**
- [ ] Backup decrypted
- [ ] Data restored successfully
- [ ] Data verified in production
- [ ] Tenant status updated
- [ ] Customer notified
- [ ] New deletion request if still desired

---

## 8. Escalation Procedures

### 8.1 If Backup Fails

```
ESCALATION LEVEL: CRITICAL

Actions:
1. Immediately stop deletion process
2. Contact Database Administrator
3. Notify Security team
4. Report to CTO
5. Create incident ticket
6. Do NOT proceed with deletion
7. Investigate failure cause
8. Attempt backup recovery
```

### 8.2 If Deletion Fails

```
ESCALATION LEVEL: HIGH

Actions:
1. Stop deletion immediately
2. Review transaction logs for errors
3. Assess what was successfully deleted
4. Determine recovery options
5. Contact data team lead
6. File incident report
7. Plan recovery strategy
8. Do NOT notify customer until situation assessed
```

### 8.3 If Legal Hold Discovered During Deletion

```
ESCALATION LEVEL: CRITICAL

Actions:
1. STOP deletion immediately (should have checked first!)
2. Contact Legal team
3. Reverse deletions if possible
4. Restore from backup (if already deleted)
5. Do NOT continue deletion
6. Document incident
7. Investigate how hold was missed
```

### 8.4 Contacts for Escalation

```
Database Team: [Contact/Email/Phone]
Security Team: [Contact/Email/Phone]
Legal Team: [Contact/Email/Phone]
CTO: [Contact/Email/Phone]
Chief Compliance Officer: [Contact/Email/Phone]
Executive On-Call: [Contact/Email/Phone]
```

---

## 9. Post-Deletion Maintenance

### 9.1 90-Day Backup Purge

**On Expiration Date:**

```bash
#!/bin/bash

BACKUP_DIR="/backups/deletion-archive"
TENANT_ID="tenant-id-here"
EXPIRATION_DATE="2026-12-10"

# Find backups past expiration
find ${BACKUP_DIR} -name "*${TENANT_ID}*" -newermt "${EXPIRATION_DATE}"

# Permanently delete (with triple wipe for security)
shred -vfz -n 3 ${BACKUP_DIR}/org-deletion-${TENANT_ID}-*.dump.gpg

# Remove from archive manifest
sed -i "/${TENANT_ID}/d" ${BACKUP_DIR}/manifest.txt

# Document in deletion audit
echo "Backup purged for ${TENANT_ID} on $(date)" >> ${BACKUP_DIR}/purge-log.txt
```

**Verification:**
- [ ] Backup file no longer exists
- [ ] Secure deletion confirmed (shred)
- [ ] Manifest updated
- [ ] Purge logged

### 9.2 Final Audit Report

Generate annual report:

```sql
-- Annual data deletion summary
SELECT 
  EXTRACT(YEAR FROM deletion_date) as year,
  COUNT(*) as deletion_count,
  SUM(records_deleted) as total_records_deleted,
  COUNT(CASE WHEN status = 'COMPLETED_AND_VERIFIED' THEN 1 END) as successful,
  COUNT(CASE WHEN status != 'COMPLETED_AND_VERIFIED' THEN 1 END) as failed
FROM compliance_deletions
GROUP BY EXTRACT(YEAR FROM deletion_date)
ORDER BY year DESC;
```

---

## 10. Checklists for Quick Reference

### Pre-Deletion Verification Checklist

```
[ ] Customer request received
[ ] Customer identity verified
[ ] Legal review completed
[ ] Compliance review completed
[ ] Executive approval obtained
[ ] Full backup created
[ ] Backup integrity tested
[ ] No legal holds in place
[ ] Customer notified of deletion plan
[ ] Support team aware
[ ] Maintenance window confirmed
[ ] Rollback plan reviewed
[ ] All team members standing by
```

### Deletion Execution Checklist

```
[ ] Marked tenant as deleted
[ ] Employee records deleted/anonymized
[ ] Attendance records deleted
[ ] Leave records deleted
[ ] Configuration data deleted
[ ] Audit logs anonymized and archived
[ ] API keys deleted
[ ] Sessions invalidated
[ ] Verified no records remain
[ ] Backup moved to archive
[ ] Verified in staging environment
[ ] Compliance certificate created
[ ] Customer notified of completion
[ ] Deletion logged in compliance system
```

### 90-Day Post-Deletion Checklist

```
[ ] Backup retention period tracked
[ ] Backup encryption verified
[ ] Archive location confirmed
[ ] Expiration date calculated
[ ] No restoration requests received
[ ] No legal holds placed
[ ] Dispute deadline passed
[ ] Backup expiration date reached
[ ] Secure deletion executed
[ ] Final audit report generated
[ ] Records archived in compliance system
```

---

## 11. Quick Reference: Data Deletion Example

**Real-world example:**

```
Customer: ACME Corporation
Deletion Request Date: 2026-09-11
Tenant ID: tenant_acme_001
Request From: John Smith, CEO

VERIFICATION (Sep 11-13)
- Legal review: Approved (Sep 13)
- Compliance: Approved (Sep 13)

BACKUP PHASE (Sep 14)
- Backup created: acme-deletion-2026-09-14.dump.gz
- Size: 2.3 GB
- Backup test: PASSED

DELETION PHASE (Sep 15)
- Deletion executed: 50 employees, 1200 attendance, 45 leave
- Backup archived: Until 2026-12-13
- Staging verification: PASSED
- Customer notified: Sep 15

RETENTION (Sep 15 - Dec 13)
- Backup location: /backups/deletion-archive/
- Retention period: 90 days
- Expiration: 2026-12-13

POST-DELETION (Dec 13)
- Backup purged: Secure deletion executed
- Final audit: Completed
- Compliance record: Archived
```

---

**Customer Data Deletion Runbook** | **Version 1.0** | **Effective September 11, 2026**

*For questions or issues, contact: privacy@company.com*

*This runbook is part of the HRMS Phase 5 Privacy and Data Retention Implementation*
