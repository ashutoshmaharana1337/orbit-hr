# Data Retention Policy

**Last Updated**: September 11, 2026

## 1. Overview

This Data Retention Policy outlines how long HRMS retains personal data, how data is deleted when retention periods expire, and procedures for legal holds when data must be retained longer.

### 1.1 Purpose

The policy ensures:
- Compliance with legal and regulatory requirements
- Ability to recover from data loss (backups)
- Deletion of unnecessary data (privacy)
- Proper handling of legal disputes
- Audit trails for compliance

### 1.2 Scope

This policy applies to:
- All personal data held in HRMS
- All backups and copies of data
- All archives and historical records
- All deletion processes and procedures

---

## 2. Data Retention Rules by Data Type

### 2.1 Active Employee Data

**Retention Period**: While employed + 30 days post-termination

**What's Included:**
- Employee name, email, phone
- Job title, department, reporting manager
- Employment status and start date
- Current compensation and benefits
- Current address and contact info
- Emergency contact information
- Current skills and certifications

**When Deleted:**
- Termination date + 30 days
- Earlier if employee requests
- Later if legal hold placed

**Exceptions:**
- Data subject to legal hold (retained indefinitely)
- Data needed for ongoing litigation (retained per legal hold)
- Data subject to arbitration (retained per process)

**Deletion Method:**
1. Mark employee as "soft deleted" (retention date set)
2. Anonymize PII (see Anonymization Strategy)
3. Keep department/role/title for audit trail
4. Hard delete after 90-day backup retention

### 2.2 Offboarded/Terminated Employee Data

**Retention Period**: 7 years from termination date

**Legal Basis:**
- IRS: 7-year requirement for payroll records (26 CFR §1.6001-1)
- State DOL: Wage/hour records (typically 3-6 years)
- ADEA: Age discrimination (3 years)
- Title VII/ADA: Employment discrimination (3-6 years)
- Best practice: 7 years covers most requirements

**What's Included:**
- Final salary and tax records (W-2, 1099)
- Final benefits and payout information
- Termination date and reason (anonymized after 2 years)
- Final attendance/leave balances
- Final performance ratings (if applicable)

**Anonymization Timeline:**
- Year 1-2: Keep full data for reference
- Year 2-7: Anonymize personal identifiers:
  - Email: `deleted_<uuid>@internal`
  - Name: `Deleted Employee`
  - Phone: NULL
  - Address: NULL
  - Keep: Department, final title, dates, comp history
- Year 7: Permanently delete

**Deletion Method:**
1. After 7 years, mark for permanent deletion
2. Create final backup snapshot (archive)
3. Hard delete from production database
4. Remove from all backups (except legal archives)
5. Document deletion in compliance log

### 2.3 Attendance Records

**Retention Period**: 3 years from creation date

**Legal Basis:**
- Fair Labor Standards Act (FLSA): Wage/hour records
- State labor laws: Typically 3 years
- Audit requirements: 3 years

**What's Included:**
- Daily clock-in/clock-out times
- Attendance status (present, absent, late)
- Overtime hours tracked
- Holiday work records
- Remote work indicators
- Any attendance exceptions

**Why 3 Years:**
- Audit statute of limitations
- Wage/hour compliance
- Dispute resolution window

**Deletion Method:**
1. Mark for deletion after 3 years
2. Archive to cold storage (6 months)
3. Hard delete from warm storage after archive
4. Keep one copy in legal archive (indefinite, if litigation)

**Exceptions:**
- Under legal hold (retained)
- Subject to wage dispute (retained until resolved)
- Under audit (retained until audit complete)

### 2.4 Leave Records

**Retention Period**: Indefinitely (employee choice to delete)

**Legal Basis:**
- Employee benefit history (indefinite)
- Dispute resolution (can take years)
- Accrual calculations (need historical data)
- Unused leave payout (need complete history)

**What's Included:**
- All leave requests (approved/denied)
- Leave balance history and accruals
- Unpaid leave and sabbaticals
- Medical leave information
- Reason for leave (optional field)
- Supporting documents (medical certs)

**Why Indefinite:**
- Employees may need leave history
- Disputes can arise years later
- Helps with buyout/payout calculations
- Legal/FMLA compliance

**Deletion Options:**
- Employee can request deletion (GDPR/CCPA right)
- Data anonymized on request (keep dates/accruals)
- Company can retain indefinitely if no request

**Deletion Method** (if requested):
1. Remove personal context (names, reasons)
2. Keep dates and accrual amounts (for records)
3. Keep department (for audit)
4. Make permanently anonymous

### 2.5 Audit Logs

**Retention Period**: 
- Minimum: 1 year (required)
- Recommended: 3 years (compliance)
- Legal hold: Indefinite if litigation

**What's Included:**
- Who accessed what data and when
- Who modified employee records (and what changed)
- System configuration changes
- Report generation and downloads
- Data exports and API usage
- Admin actions
- Failed login attempts
- Access denied events
- Data deletion records

**Why Immutable:**
- Legal requirement
- Fraud detection and investigation
- Compliance audits
- Regulatory requests
- Data breach investigation

**Immutability Rules:**
- Audit logs cannot be modified
- Audit logs cannot be deleted
- Can only be archived (moved to cold storage)
- Archive kept for at least 3 years

**Deletion Method:**
1. After 1 year: Can be archived to cold storage
2. Archive retention: Minimum 3 years from creation
3. Hard delete only after full retention period
4. Document all deletions in higher-level audit log

**Exception - Security Incidents:**
- If audit log itself compromised, escalate immediately
- Cannot modify/delete (maintains integrity)
- Report to regulators if required
- Consider re-creation from backup if trust lost

### 2.6 Deleted/Anonymized Data

**Backup Retention**: 90 days

**Legal Basis:**
- Disaster recovery window
- Dispute resolution period (customer requests rarely disputed after 90 days)
- Regulatory requirement (GDPR right to erasure)

**What's Included:**
- Soft-deleted employee records (90 days before hard delete)
- Anonymized PII (90 days before hard delete)
- Backup copies of deleted data
- Recovery snapshots

**Why 90 Days:**
- Allows recovery from mistakes
- Covers most dispute periods
- Complies with backup retention standards
- Allows time for legal hold placement

**Deletion Process:**
1. Data marked soft-deleted (createdAt timestamp set)
2. Kept in warm storage for 30 days (visible to admins)
3. Moved to cold storage (backup only) for 60 more days
4. Hard delete from all storage after 90 days
5. No recovery possible after hard delete

**Exception - Legal Holds:**
- If legal hold placed within 90 days
- Data retained until hold released
- Release must be documented
- Then follows normal 90-day backup retention

### 2.7 Customer Data Deletions

**Retention Period**: 90 days (then permanent deletion)

**When Deletion Occurs:**
- Customer requests complete deletion
- Verified through legal/compliance process
- Backups created for legal protection
- Data anonymized and deleted from production

**Timeline:**
- Day 0: Deletion request received and verified
- Day 0: Production deletion executed
- Day 0-90: Backup retention for recovery/dispute
- Day 90: Final deletion from all backups

**What's Deleted:**
- All employee records (anonymized)
- All attendance records
- All leave records
- All customer-specific settings
- All custom fields and data
- System usage logs (anonymized)

**What's Retained:**
- Audit log (for compliance, anonymized)
- Immutable transaction records (if applicable)
- Billing records (7 years for tax)
- Support tickets (2 years, anonymized)

### 2.8 Support & Communication Data

**Retention Period**: 2 years from last communication

**What's Included:**
- Support tickets and email correspondence
- Chat logs with support team
- Feature requests and feedback
- Support documentation created
- Screenshots and attachments
- Escalation history

**Deletion Method:**
1. Close ticket and set 2-year expiration
2. After 2 years, archive to cold storage
3. 6 months later, hard delete
4. Keep summary of resolved issues (anonymized)

### 2.9 API Access Logs

**Retention Period**: 90 days

**What's Included:**
- API requests and responses
- Authentication tokens used
- Rate limiting events
- Quota usage
- Error responses

**Deletion Method:**
1. Archived after 30 days (to cold storage)
2. Hard deleted after 90 days
3. Summary statistics kept (requests/day, not details)

### 2.10 Error & System Logs

**Retention Period**: 30 days (warm), 90 days (cold)

**What's Included:**
- Application errors and exceptions
- Stack traces and debug information
- Performance logs
- Deployment logs
- System events

**Personally Identifiable Information:**
- Remove PII from logs (user IDs, not names)
- Anonymize error contexts
- Remove sensitive parameters

**Deletion Method:**
1. Warm storage (searchable): 30 days
2. Cold storage (archive): 60 more days
3. Hard delete: After 90 days total

### 2.11 Payment & Billing Data

**Credit Card Information**: NOT retained
- Processed securely by payment processor (PCI-DSS compliant)
- We store only: Token, last 4 digits, expiration month/year
- Never store full credit card numbers

**Billing Records**: 7 years
- Invoice history
- Subscription plan changes
- Payment method (tokenized only)
- Billing address (for billing purposes)
- Tax records

**Deletion**: 7 years after last transaction

### 2.12 Backup and Disaster Recovery Data

**Retention Period**: 90 days minimum

**Storage Tiers:**
- **Hot Backups**: Daily (7 days)
  - Immediate restore capability
  - Warm storage (searchable)
  - Quick recovery (< 1 hour)

- **Warm Backups**: Weekly (30 days)
  - 1-2 hour restore time
  - Cold storage (archive)
  - Used for disaster recovery

- **Cold Backups**: Monthly (90 days)
  - 4-24 hour restore time
  - Archive storage
  - Compliance and legal holds

**Deletion Method:**
1. Automatic deletion after retention period
2. Documented in backup schedule
3. Verified by monitoring system
4. No manual deletion needed

**Exception - Legal Holds:**
- If data under legal hold, all backups retained
- Hold released by legal team
- Then follows normal backup schedule

---

## 3. Automatic Data Purging

### 3.1 Purging Schedule

**Monthly Purging Process:**

1. **First of Month**:
   - Identify data past retention date
   - Generate purge list
   - Flag data for deletion (soft delete)
   - Send notification to data owners

2. **Mid-Month**:
   - 30-day legal hold window opens
   - Stakeholders can place holds on flagged data
   - Holds documented in audit log

3. **End of Month**:
   - Execute hard deletes (if no holds placed)
   - Archive soft-deleted data to cold storage
   - Generate purging report
   - Notify stakeholders of completion

**Audit Trail:**
- Record of what was purged
- Timestamp of purge
- User who approved purge
- Items that placed on hold
- Backup retention details

### 3.2 Data Purging Service Implementation

**Scheduled Jobs:**

```sql
-- Monthly purge job (runs on 1st of month at 2 AM UTC)
SELECT * FROM employees WHERE deleted_at < NOW() - INTERVAL '90 days'
-- Hard delete soft-deleted employees

SELECT * FROM attendance WHERE created_at < NOW() - INTERVAL '3 years'
-- Delete old attendance records

SELECT * FROM deleted_data_archive WHERE 
  deleted_at < NOW() - INTERVAL '90 days' AND 
  legal_hold IS NULL
-- Purge archived data if no hold

SELECT * FROM audit_logs WHERE 
  created_at < NOW() - INTERVAL '3 years' AND
  legal_hold IS NULL
-- Archive audit logs older than 3 years
```

**Process Monitoring:**

- Real-time alerts for purging errors
- Daily summary report of purged items
- Weekly audit of deletion logs
- Monthly stakeholder notification

### 3.3 Data Purging Workflow

**Workflow:**
```
1. Identify Eligible Data
   - Query data past retention date
   - Exclude legally held data
   - Generate purge candidate list

2. Legal Hold Check
   - Check if data under legal hold
   - Check if related to open disputes
   - Check if related to litigation
   - Skip if hold found

3. Notify Stakeholders (30 days before)
   - Email to relevant teams
   - Data type and count
   - Scheduled deletion date
   - Instructions for placing hold

4. Execute Deletion
   - Soft delete (mark deleted_at)
   - Create backup snapshot
   - Move to cold storage
   - Log deletion

5. Verify Deletion
   - Spot check deleted records
   - Verify data not accessible
   - Confirm backups created
   - Generate report

6. Hard Delete (after 90 days)
   - Hard delete from warm storage
   - Hard delete from recent backups
   - Remove from production indexes
   - Generate deletion report
```

### 3.4 Restoration Procedures

**If Deletion Error Occurs:**

1. **Within 7 Days**:
   - Restore from daily backup
   - Minimal data loss (< 1 day)
   - Automatic if error detected

2. **Within 30 Days**:
   - Restore from weekly backup
   - May lose up to 1 week of data
   - Manual restore process

3. **Within 90 Days**:
   - Restore from monthly backup
   - May lose up to 1 month of data
   - 4-24 hour restore time

4. **After 90 Days**:
   - No recovery option
   - Data permanently deleted
   - Cannot be restored

---

## 4. Legal Holds

### 4.1 Legal Hold Procedures

**When Legal Hold Placed:**

A legal hold is placed when:
- Litigation is anticipated or pending
- Regulatory investigation underway
- Subpoena or discovery request received
- Data potentially relevant to legal claim
- Employee dispute or grievance filed
- Internal investigation requires preservation

**Who Can Place Hold:**
- Legal team (primary authority)
- Compliance team (with legal approval)
- HR (with legal approval)
- Executive leadership (with legal approval)

**Hold Authorization:**

```
Legal Hold Placement Form:
- Reason for hold (litigation, investigation, etc.)
- Scope: What data to hold (employee records, attendance, etc.)
- Duration: How long to hold (until date or event)
- Responsible party: Who to contact
- Sign-off: Legal signature required
```

### 4.2 Scope of Legal Holds

**Typical Scope:**
- All data for involved employee(s)
- All related documents and communications
- All audit logs involving the data
- All backup copies
- Related third-party data (if applicable)

**Hold Requests:**
- Must specify data scope (not overly broad)
- Must specify reason (legal basis required)
- Must specify duration or condition

**System Implementation:**
```sql
-- Mark data under legal hold
UPDATE employees 
SET legal_hold = true, 
    legal_hold_reason = 'Litigation - Smith v. Company',
    legal_hold_date = NOW()
WHERE id IN (...);

-- Prevent deletion of held data
-- Purging job skips all records with legal_hold = true
```

### 4.3 Hold Lifecycle

**Placement:**
1. Legal team submits hold request
2. Compliance reviews and approves
3. System flags all related data
4. Hold recorded in hold register
5. Stakeholders notified of hold
6. Purging processes skip held data

**Maintenance:**
- Hold reviewed quarterly (at minimum)
- Extended if still relevant
- Cancelled if no longer needed
- Documentation maintained

**Release:**
1. Legal team determines hold no longer needed
2. Signs release authorization
3. System removes hold flag
4. Data follows normal retention schedule
5. Data retained for 90-day backup period
6. Then deleted per policy

**Documentation:**
- Hold register maintained (all active holds)
- Hold release log (all released holds)
- Disposal documentation (when data finally deleted)

---

## 5. GDPR Right to be Forgotten (Right to Erasure)

### 5.1 Legal Basis for Retention Exceptions

Under GDPR Article 17, we may retain data even after erasure request in these cases:

**Legal Compliance:**
- Tax reporting (7 years)
- Wage and hour laws (3-7 years)
- Equal pay analysis (3-5 years)
- Employment law compliance

**Legal Claims:**
- Active litigation or disputes
- Anticipated legal claims
- Regulatory investigations
- Arbitration proceedings

**Legitimate Interests:**
- Fraud detection and prevention
- System security
- Data integrity

**Archived Data:**
- Backup copies (90-day retention for recovery)
- Anonymized data (kept for compliance/audit)

### 5.2 Partially Anonymized Retention

When data cannot be fully deleted due to legal requirements:

**Anonymization Strategy:**
- Remove name: Replace with "Deleted Employee"
- Remove email: Replace with unique hash (cannot identify person)
- Remove phone: Set to NULL
- Remove address: Set to NULL
- Remove PII: All identifiers removed

**Retained Fields** (for audit/compliance):
- Employee ID (internal reference)
- Department and role (for org audit)
- Employment dates
- Compensation history (for tax/legal)
- Termination reason (anonymized if possible)
- Audit trail of access

**Example Before/After:**

**Before Anonymization:**
```json
{
  "id": "emp_123",
  "name": "John Smith",
  "email": "john.smith@company.com",
  "phone": "555-0123",
  "address": "123 Main St",
  "salary": 75000,
  "department": "Engineering",
  "termination_date": "2026-09-01"
}
```

**After Anonymization:**
```json
{
  "id": "emp_123",
  "name": "Deleted Employee",
  "email": "hash_3f7b4a9c@internal",
  "phone": null,
  "address": null,
  "salary": 75000,  // Required for tax records
  "department": "Engineering",
  "termination_date": "2026-09-01"
}
```

### 5.3 GDPR Right to Erasure Process

**Request Received:**
1. Verify identity of data subject
2. Confirm no legal hold in place
3. Assess retention exceptions
4. Plan anonymization/deletion

**Data Assessment:**
- Check if data subject of legal claims
- Check if under audit
- Check if needed for tax/compliance
- Determine what can be deleted vs. anonymized

**Execution (within 30 days):**
1. Create backup (for audit)
2. Anonymize PII
3. Delete personal data (where legal to do so)
4. Retain anonymized data (if needed)
5. Document deletion in compliance log
6. Notify data subject of completion

**Data Subject Rights After Deletion:**
- Cannot access personal data anymore
- Can verify deletion (provide certificate)
- Can request retention exceptions explanation
- Can lodge complaint if dissatisfied

---

## 6. Third-Party Data and Sub-processors

### 6.1 Data from Integrated Systems

When data integrated from external systems (payroll, benefits, etc.):

**Responsibility:**
- We are data processor for integrated data
- Customer is data controller
- Sub-processor has its own retention policy
- We enforce our minimally sufficient retention

**Retention:**
- Same as our data (per this policy)
- Synced data deleted per schedule
- Do not rely on external system deletions
- Create our own backups

### 6.2 Sub-processor Retention

**Data Processor Agreements Include:**
- Specific retention periods required
- Deletion procedures upon request
- Backup retention limits
- Legal hold coordination

**Sub-processors:**
- Cloud hosting (AWS, Google Cloud): Follow our schedule
- Backup providers: 90-day retention
- Analytics: 13-month retention
- Email: 2-year retention

### 6.3 Data Leaving HRMS

**Data Exports by Customer:**
- Retention responsibility transfers to customer
- We document date of export
- We are not responsible for exported data retention
- Customer must handle per GDPR/CCPA

**Data Deletion Requests to Sub-processors:**
- We submit deletion requests to all sub-processors
- Verify deletion completions
- Document completion in audit log
- Maintain evidence of deletion requests

---

## 7. Compliance & Audit

### 7.1 Retention Policy Compliance

**Monitoring:**
- Monthly reports of data purged
- Quarterly audit of retention compliance
- Annual external audit (SOC 2)
- Continuous automated checks

**Violations:**
- Data deleted before retention date
- Data retained beyond retention date
- Audit logs modified or deleted
- Legal hold not respected

**Escalation:**
- Immediate notification to compliance officer
- Investigation within 48 hours
- Root cause analysis
- Corrective action plan
- Executive notification if material

### 7.2 Audit Trails

**Deletion Audit Log:**

```
Deletion Event Record:
- Data type (employee, attendance, etc.)
- Record ID(s)
- Deletion date and time
- Reason for deletion (retention expired, request, etc.)
- Authorized by (user/process)
- Method (soft delete, hard delete, anonymize)
- Retention period that expired
- Legal hold status
- Backup status
- Verification performed
```

**Retention of Deletion Records:**
- Kept indefinitely (compliance requirement)
- Cannot be modified
- Separate from deleted data
- Accessible to auditors

### 7.3 Regulatory Cooperation

**If Regulator Requests Data:**
1. Verify legitimacy of request (subpoena, etc.)
2. Check for legal hold in place
3. Do not delete held data
4. Provide data in requested format
5. Document in legal hold register

**If Customer Requests Data:**
1. Verify customer identity
2. Confirm data exists (may be deleted)
3. Provide available data
4. Document request and response
5. Explain if data cannot be provided (deleted per policy)

---

## 8. Special Circumstances

### 8.1 Disputed Deletions

If employee disputes deletion after the fact:

**Process:**
1. Employee submits written dispute
2. Compliance review within 5 days
3. Check backup status (within 90 days possible)
4. If within 90 days and backups exist: Restore
5. If beyond 90 days: Data permanently deleted
6. Document dispute resolution

**Prevention:**
- Notify before deletion (30-day hold period)
- Allow placement of holds
- Verify instructions before deletion
- Confirm deletion with stakeholder

### 8.2 Backup Corruption or Failure

**If Backup Fails:**
- Immediately alert data recovery team
- Attempt recovery from other backup
- If recovery possible: Restore and verify
- If recovery impossible: Document in disaster log

**If Backup Corrupted:**
- Identify what was corrupted
- Restore from prior backup
- Verify integrity
- Assess if data recovery possible
- Document incident

### 8.3 Regulatory Changes

**If Retention Requirements Change:**
1. Legal review of new requirements
2. Assess current retention practices
3. Update this policy
4. Implement new procedures
5. Audit historical data compliance
6. Notify affected customers

---

## 9. Data Subject Access

### 9.1 Accessing Your Retained Data

If you request access to your data:

1. **If Within Retention Period:**
   - Data provided in requested format (PDF, CSV, JSON)
   - Served from production database
   - Response within 30 days

2. **If Beyond Retention Period but in Backups:**
   - May be available from backup
   - Backup restoration may take 1-2 days
   - Provided if backup recovery possible
   - Response within 45 days

3. **If Data Deleted and Not in Backups:**
   - We confirm data is not available
   - Explain retention period that applied
   - Explain why data deleted
   - Provide deletion timestamp (if available)

### 9.2 Verification of Deletion

After deletion, if you want to verify data is deleted:

1. **Deletion Certificate:**
   - Request deletion verification from privacy@company.com
   - Verified deletion certificate issued
   - Lists what was deleted
   - Timestamp of deletion
   - Signature from authorized officer

2. **Technical Verification:**
   - Third-party auditor can verify
   - Forensic verification available upon request
   - Documentation provided to data subject

---

## 10. Implementation Timeline

### 10.1 Rollout Schedule

**Phase 1 (Week 1-2):**
- Implement data retention service
- Configure retention rules in database
- Set up purging schedules
- Deploy monitoring

**Phase 2 (Week 3-4):**
- Audit current data against policy
- Identify data past retention dates
- Begin regular purging schedule
- Create audit trail of first purging

**Phase 3 (Week 5-6):**
- Full compliance audit
- Legal hold system operational
- Restore procedures tested
- Staff trained on procedures

**Phase 4 (Week 7+):**
- Ongoing maintenance
- Monthly purging
- Quarterly audits
- Annual external verification

---

## 11. Acknowledgment

This Data Retention Policy is effective immediately and applies to all personal data held in HRMS.

**For Questions:**
- Contact: privacy@company.com
- Policy Owner: Privacy Officer
- Legal Review: Legal Department

---

**Data Retention Policy** | **Version 1.0** | **Effective September 11, 2026**

*This policy is part of the HRMS Phase 5 Privacy and Data Retention Implementation*
