# Privacy Policy

**Last Updated**: September 11, 2026

## 1. Introduction

This Privacy Policy explains how HRMS ("we," "us," "our," or "Company") collects, uses, discloses, and safeguards information about our customers, their employees, and any other individuals ("you," "your," or "users") in connection with our Human Resource Management System (HRMS) platform.

We are committed to protecting your privacy and ensuring you have a positive experience on our platform. This policy covers:
- What personal data we collect
- How we use and process your data
- How we protect your data
- Your rights regarding your data
- How long we retain your data
- Who we share data with
- How to contact us about privacy

### Privacy Principles

We follow these core principles:
- **Transparency**: We clearly explain what data we collect and why
- **Purpose Limitation**: We only use data for stated purposes
- **Minimization**: We collect only the data we need
- **Security**: We protect data with strong security measures
- **User Rights**: Users have full control over their personal data
- **Accountability**: We take responsibility for our data practices

### Regulatory Framework

This policy addresses requirements under:
- GDPR (General Data Protection Regulation) - EU and UK
- CCPA (California Consumer Privacy Act)
- Other applicable privacy laws

---

## 2. Data We Collect

### 2.1 Employee Data

We collect the following employee information to provide HRMS functionality:

**Personal Identifiers:**
- Full name (first and last name)
- Email address (work and personal if provided)
- Phone number (mobile and office)
- Employee ID number
- Date of birth (for age-restricted roles)
- Gender/pronouns (optional, for diversity tracking)

**Employment Data:**
- Job title and job level
- Department and reporting manager
- Employment start date and employment type (full-time, part-time, contract, etc.)
- Salary and compensation information
- Tax information (W-2, 1099, or equivalent)
- Bank account information (for direct deposit)
- Employee classification (exempt/non-exempt, etc.)

**Address Information:**
- Home address
- Work address
- Emergency contact addresses

**Professional Information:**
- Skills and qualifications
- Certifications and licenses
- Educational background
- Performance ratings and reviews
- Training records
- Promotion history

**Contact Information:**
- Work email
- Work phone
- Personal contact numbers
- Emergency contact information

**Technical Information:**
- IP address (from login attempts)
- Device information (from system access)
- Login timestamps
- API token usage

### 2.2 Attendance Data

We track and store:
- Clock-in and clock-out timestamps
- Daily attendance status (present, absent, late, leave)
- Remote work indicators
- Location data (if geo-tagging enabled)
- Attendance exceptions and approvals

### 2.3 Leave and Absence Data

We collect and maintain:
- Leave requests (dates, types, status)
- Approved and denied leave
- Leave balance and accrual
- Reason for leave (optional, provided by employee)
- Medical certificates or supporting documents
- Sick leave patterns
- Unpaid leave records
- Sabbatical and extended absence records

### 2.4 Audit Log Data

We automatically log:
- Who accessed what data and when
- Who modified employee records
- What changes were made
- When reports were generated
- Admin actions and configuration changes
- API usage and authentication events
- Data export and download requests

### 2.5 System Usage Data

We collect:
- Login times and frequency
- Features used
- Report generation patterns
- Export and download activity
- Error logs and system warnings
- Support ticket information

### 2.6 Communication Data

If you contact us for support, we collect:
- Support tickets and email correspondence
- Chat conversations
- Phone call logs (if recorded)
- Feedback and feature requests

### 2.7 Payment Data

For billing customers:
- Company name and address
- Billing contact person
- Payment method information (processed securely by payment processor)
- Invoice history
- Subscription plan details

**Note**: We do NOT store complete credit card information. Payment processing is handled by PCI-DSS compliant payment processors (Stripe, etc.).

### 2.8 How We Collect Data

Data collection methods:
- **Direct Input**: Information you enter into the system
- **Automated Collection**: System logs, timestamps, IP addresses
- **File Uploads**: Resumes, certifications, supporting documents
- **Integrations**: Data from HR systems, payroll software, or SSO providers
- **Browser/Device**: Cookies, log files, analytics

---

## 3. Data Usage

### 3.1 Primary Use Cases

**HR Operations & Administration**
- Managing employee records and personnel files
- Processing payroll and compensation
- Managing benefits and leave
- Scheduling and shift management
- Performance management and reviews
- Training and development
- Compliance with labor laws

**Attendance & Time Tracking**
- Tracking employee attendance and punctuality
- Managing shift assignments
- Calculating overtime
- Recording time off
- Ensuring workplace compliance

**Leave Management**
- Processing leave requests
- Tracking leave balances
- Maintaining leave history
- Calculating accruals
- Compliance with leave policies and labor laws

**Analytics & Reporting**
- Generating HR analytics and dashboards
- Departmental performance analysis
- Employee retention analysis
- Diversity and inclusion reporting
- Attendance trends
- Leave utilization analysis

**Compliance & Legal**
- Meeting labor law requirements
- Tax reporting (W-2, 1099, 940, 941, etc.)
- Wage and hour compliance
- Equal opportunity compliance
- ERISA and benefits compliance
- Audit trails for legal disputes
- Responding to legal requests

### 3.2 Secondary Use Cases

**System Improvement**
- Debugging system errors
- Performance optimization
- Feature development
- User experience improvement

**Customer Support**
- Responding to support requests
- Troubleshooting issues
- Accessing customer data (with authorization) to resolve problems

**Security & Fraud Prevention**
- Detecting and preventing unauthorized access
- Identifying data breaches
- Investigating suspicious activity
- Preventing system abuse

**Marketing (with consent)**
- Sending product updates
- Announcing new features
- Inviting to webinars or events
- Customer testimonials (with explicit consent)

### 3.3 Automated Decision Making

We do not use automated decision-making for:
- Disciplinary actions
- Termination decisions
- Promotion decisions
- Compensation changes

HR personnel review all major personnel decisions with human judgment.

### 3.4 Lawful Basis for Processing

We process personal data based on:

**Contract**: Processing necessary to provide HRMS services to your organization

**Legitimate Interests**: 
- System security and fraud prevention
- Service improvement
- Analytics and reporting

**Legal Obligation**: 
- Compliance with tax laws
- Labor and employment laws
- Legal holds and litigation

**Consent**: 
- Marketing communications (opt-in)
- Optional analytics
- Data exports or analysis beyond core HR functions

**Public Task**: 
- Complying with public health or safety orders

---

## 4. Data Security

### 4.1 Encryption

**Data in Transit:**
- All communications between client and server use TLS 1.3 encryption
- HTTPS enforced for all connections
- HSTS headers prevent downgrade attacks
- Certificate pinning in mobile apps (where applicable)

**Data at Rest:**
- All sensitive data encrypted using AES-256
- Database encryption at storage level
- Backups encrypted with separate keys
- Encryption keys managed securely (see 4.2)

**Sensitive Fields Encrypted:**
- Employee email addresses
- Phone numbers
- Social security numbers
- Bank account information
- Tax identifiers
- Salary information

### 4.2 Key Management

- Encryption keys stored in hardware security modules (HSM) or secure key vaults
- Keys never hardcoded in application code
- Key rotation every 90 days minimum
- Separate keys for different environments
- Access to key management restricted to infrastructure team
- Audit logs for all key access

### 4.3 Access Controls

**Role-Based Access Control (RBAC):**
- Admin: Full system access
- HR Manager: Can view and manage employee data
- Department Manager: Can view/manage direct reports only
- Employee: Can view own data and some HR-related info
- Auditor: Read-only access to audit logs
- Payroll: Can view salary/compensation data
- Support: Limited access with manager approval

**Row-Level Security (RLS):**
- Database-level enforcement using PostgreSQL RLS policies
- Employees can only see their own data
- Managers can only see their direct reports
- No data leaks through SQL queries or API endpoints

**Principle of Least Privilege:**
- Users have minimum necessary permissions
- Permissions granted for specific purposes and durations
- Regular audit of access permissions
- Immediate revocation upon role change or termination

### 4.4 Audit Logging

- All data access logged with timestamp and user
- All modifications recorded with before/after values
- All exports and downloads logged with business purpose
- Admin actions logged in separate audit table
- Audit logs retained for 3 years minimum (see Data Retention)
- Audit logs immutable (cannot be modified or deleted)

### 4.5 Data Minimization

- We collect only data necessary for stated purposes
- Regular data inventory audits
- Automatic deletion of data past retention period
- Soft deletes for data kept for audit purposes
- No unnecessary data replication or backup

### 4.6 Employee Training

- All staff handling personal data completes privacy training
- Annual refresher training required
- Data handling procedures documented
- Secure password practices enforced
- Multi-factor authentication (MFA) required for admin access

### 4.7 Third-Party Security

- Vendors and contractors sign Data Processing Agreements (DPAs)
- Regular security assessments of vendors
- Background checks for personnel accessing data
- Confidentiality agreements required
- SOC 2 Type II compliance verified annually

### 4.8 Application Security

- Regular security patching and updates
- Web Application Firewall (WAF) deployed
- DDoS protection enabled
- SQL injection prevention through prepared statements
- Cross-Site Scripting (XSS) prevention
- Cross-Site Request Forgery (CSRF) tokens
- Regular penetration testing
- Security headers (CSP, X-Frame-Options, etc.)
- API rate limiting and throttling

### 4.9 Incident Response

- 24/7 security monitoring
- Intrusion detection systems (IDS)
- Real-time alerts for suspicious activity
- Incident response plan with clear escalation
- Forensic capabilities for investigation
- Breach notification procedures (see Breach Notification Policy)

---

## 5. User Rights

### 5.1 Right to Access (GDPR Art. 15, CCPA §1798.100)

You have the right to request a copy of your personal data that we hold.

**How to Request:**
- Submit a written request to privacy@company.com
- Include your name and email
- Specify which data you want to access
- Provide ID verification

**Our Commitment:**
- Respond within 30 days (GDPR) or 45 days (CCPA)
- Provide data in commonly used format (PDF, CSV, JSON)
- No charge for reasonable requests
- Extensions possible for complex requests (communicated within 30 days)

### 5.2 Right to Correction/Rectification (GDPR Art. 16, CCPA §1798.106)

You can request correction of inaccurate personal data.

**What You Can Correct:**
- Employee contact information
- Job title and department
- Address information
- Phone number
- Emergency contact details

**Restrictions:**
- Cannot modify:
  - Historical attendance records (for audit accuracy)
  - Past leave requests (for legal compliance)
  - Compensation history (for tax compliance)
  - Completed performance reviews (for dispute resolution)
  - Audit logs (for legal compliance)

**How to Request:**
- Submit correction through employee portal
- Contact HR manager with documentation
- Contact privacy@company.com with formal request

**Our Commitment:**
- Update incorrect data within 5 business days
- Notify third parties of corrections (where applicable)
- Maintain audit trail of corrections

### 5.3 Right to Erasure ("Right to be Forgotten") (GDPR Art. 17, CCPA §1798.105)

In certain circumstances, you have the right to request deletion of your personal data.

**When Granted:**
- Data no longer necessary for original purpose
- You withdraw consent (when applicable)
- You object to processing
- Data processed unlawfully
- Legal obligation requires deletion

**When NOT Granted:**
- Data needed for legal compliance (tax, wage/hour laws)
- Data subject to legal hold
- Data necessary to protect others' rights
- Data being processed for legitimate interests that outweigh your rights
- Data used for audit or compliance purposes

**How to Request:**
- Submit data deletion request to privacy@company.com
- Request processed within 30 days
- Specify what data should be deleted
- Provide ID verification

**What Happens:**
- Sensitive personal data anonymized or deleted
- Retention data (7-year legal holds) kept for compliance
- Backup copies held for 90 days (for disaster recovery)
- Data retained if legal hold active

### 5.4 Right to Restriction of Processing (GDPR Art. 18)

You can request that we limit how we use your data.

**Example Restrictions:**
- Process data only for specific purposes
- Do not delete data (under dispute)
- Do not share with third parties

**How to Request:**
- Submit request to privacy@company.com
- Describe restriction desired
- Explain why restriction needed

**Our Commitment:**
- Acknowledge restriction within 5 days
- Implement restriction within 30 days
- Notify third parties of restrictions

### 5.5 Right to Data Portability (GDPR Art. 20)

You can request your data in a portable format.

**Included Data:**
- Personal identifiers
- Contact information
- Employment records
- Attendance history
- Leave balances
- Performance data
- Compensation history

**Format Provided:**
- CSV (most common)
- JSON (for systems integration)
- XML (for compatibility)

**How to Request:**
- Submit through employee portal
- Contact privacy@company.com

**Our Commitment:**
- Respond within 30 days
- Provide data in commonly used format
- No charge for first request per year

### 5.6 Right to Object to Processing (GDPR Art. 21)

You can object to processing of your data for specific purposes.

**Grounds to Object:**
- Direct marketing
- Profiling for marketing
- Processing for legitimate interests
- Scientific/statistical purposes

**Example:**
- Opt out of optional analytics
- Opt out of email communications
- Opt out of performance tracking

**How to Request:**
- Submit through employee preferences
- Contact privacy@company.com
- Email unsubscribe links

**Our Commitment:**
- Honor objections within 30 days
- Cease processing except where legally required
- Maintain record of objection

### 5.7 Rights Related to Automated Decision Making (GDPR Art. 22)

We do not make significant decisions about you using only automated processing. All major HR decisions involve human review.

### 5.8 How to Exercise Your Rights

**Contact Information:**
```
Privacy Officer
Email: privacy@company.com
Mailing Address:
HRMS Privacy Team
[Company Address]
```

**Process:**
1. Submit written request with ID verification
2. Receive acknowledgment within 5 business days
3. Request processed within 30 days (can extend 60 days for complex requests)
4. Receive response with data/explanation
5. Can appeal decision if denied

**No Retaliation:**
- We never retaliate for exercising privacy rights
- No employment consequences for data requests
- No discrimination in service provision

---

## 6. GDPR Compliance

### 6.1 Lawful Basis

We process personal data under the following lawful bases:

**Contract (GDPR Art. 6(1)(b)):**
- Processing necessary to provide HRMS services
- Employment-related data processing

**Legitimate Interests (GDPR Art. 6(1)(f)):**
- System security and fraud prevention
- Analytics and service improvement
- Legal and compliance purposes

**Legal Obligation (GDPR Art. 6(1)(c)):**
- Tax reporting and withholding
- Labor law compliance
- Data protection law compliance
- Legal holds and litigation

**Consent (GDPR Art. 7):**
- Marketing communications (opt-in)
- Optional analytics and tracking
- Cookie placement

**Public Task (GDPR Art. 6(1)(e)):**
- Complying with government requests
- Public health or safety orders

### 6.2 International Data Transfers

**For EU/UK Residents:**
- We use Standard Contractual Clauses (SCCs) for transfers to US
- We comply with UK's data protection legislation
- We ensure adequate safeguards for all transfers
- We maintain records of transfer legal basis

**Adequacy Decisions:**
- We rely on EU-UK Adequacy Decisions where available
- We use Binding Corporate Rules (BCRs) where applicable
- We conduct Transfer Impact Assessments (TIAs)

### 6.3 Data Processing Agreements

- We execute Data Processing Agreements (DPAs) with customers
- DPA includes GDPR-required clauses
- Sub-processors listed in DPA Addendum A
- Customers have right to object to sub-processors

### 6.4 Data Protection Officer

- Our Data Protection Officer (DPO) can be contacted at: dpo@company.com
- DPO independent and impartial
- DPO reports directly to executive management
- DPO available for privacy inquiries and complaints

### 6.5 Regulatory Compliance

- We comply with GDPR Article 25 (Data Protection by Design and Default)
- Privacy Impact Assessments conducted for new processing
- Records of processing activities maintained
- Regular risk assessments conducted

---

## 7. CCPA Compliance (California Residents)

### 7.1 California Consumer Rights

If you are a California resident, you have the following rights under CCPA:

**Right to Know (§1798.100):**
- Request what categories of personal information we collect
- Know how we use your information
- Know who we share information with

**Right to Delete (§1798.105):**
- Request deletion of personal information we collected
- Limited exceptions for legally required data

**Right to Correct (§1798.106):**
- Request correction of inaccurate information

**Right to Opt Out (§1798.120):**
- Opt out of "sale" of personal information
- Opt out of "sharing" for targeted advertising
- Opt out of automated decision making

**Right to Non-Discrimination (§1798.125):**
- No discrimination for exercising CCPA rights
- No higher prices or reduced service quality
- No retaliation

### 7.2 California Privacy Notice

**Information We Collect:**
- Personal identifiers (name, email, phone)
- Employment information (job title, department, salary)
- Attendance and leave data
- Device information (IP address, login timestamps)

**How We Use Information:**
- Providing HR services
- Compliance with employment laws
- Analytics and reporting
- Security and fraud prevention
- Customer support

**Who We Share With:**
- Service providers (payroll, benefits, email)
- Legal and law enforcement (when required)
- Business partners (with consent)

**Your Rights:**
- Request access to data we hold (free, once per 12 months)
- Request deletion of data (with exceptions)
- Request correction of inaccurate data
- Opt out of data sales/sharing
- Opt out of automated decision making

**How to Submit Requests:**
- Email: privacy@company.com
- Portal: www.company.com/privacy-requests
- Phone: 1-800-XXX-XXXX
- Mail: Privacy Team, [Address]

**Verification:**
- We verify requests to protect privacy
- May ask for ID matching our records
- May verify through email confirmation

**Response Times:**
- Confirm receipt within 10 days
- Respond to requests within 45 days
- Can extend 45 days if complex (will notify)

### 7.3 Shine the Light Law (CA Civil Code §1798.83)

California residents can request information about personal information shared with third parties for their direct marketing purposes.

**Annual Request:**
- Limited to one request per year
- Free of charge
- Request process same as above

### 7.4 Biometric Information (CA Consumer Privacy Act §1798.100(e))

We do NOT collect or store biometric information except:
- Fingerprints (if biometric time clocks used, with employee consent)
- Facial recognition (only if explicitly enabled by organization, with consent)

**Requirements:**
- Written notice required before collection
- Specific retention policy provided
- Annual re-verification of consent required
- Secure storage and encryption required

---

## 8. Cookie Policy

### 8.1 What Are Cookies?

Cookies are small files stored on your device that help us provide and improve our services. We use cookies to:
- Keep you logged in
- Remember your preferences
- Track how you use our service (analytics)
- Prevent fraud and enhance security

### 8.2 Types of Cookies We Use

**Essential Cookies (Required):**
- `session_id`: Maintains your login session
- `csrf_token`: Prevents cross-site request forgery
- `user_preferences`: Remembers your display preferences
- Duration: Session or 30 days

**Analytics Cookies (Optional):**
- `analytics_id`: Anonymous user identification
- `_ga`: Google Analytics tracking
- Tracks page views, features used, performance
- Duration: 2 years
- Requires consent

**Security Cookies:**
- `secure_token`: Temporary security token
- `mfa_state`: Multi-factor authentication state
- Duration: Session

### 8.3 Third-Party Cookies

We work with:
- Google Analytics: Anonymous usage analytics
- Sentry: Error tracking and monitoring
- Intercom: Customer support (optional)

Each third party has their own privacy policy.

### 8.4 Cookie Preferences

**How to Manage:**
- Browser settings: Accept/reject cookies
- Cookie preference center: On our website
- Opt out of analytics: privacy@company.com

**Cookie Removal:**
- Clear cookies in browser settings
- Third-party tools (opt-out.aboutads.info)

### 8.5 Tracking Technologies

We may also use:
- Web beacons (tracking pixels)
- Local storage (similar to cookies)
- Server logs (IP addresses, page requests)

Same preferences apply to all tracking technologies.

---

## 9. Data Sharing & Third Parties

### 9.1 Who We Share Data With

**Service Providers** (Data Processors):
- **Payroll & HR Software**: ADP, Gusto, Bamboo HR (salary/benefits processing)
- **Email & Communication**: SendGrid, Mailgun (notifications)
- **Analytics**: Google Analytics, Mixpanel (usage analytics)
- **Cloud Infrastructure**: AWS, Google Cloud, Azure (data hosting)
- **Payment Processors**: Stripe, PayPal (billing)
- **Backup & Disaster Recovery**: Backblaze, Veeam (data protection)
- **Security & Monitoring**: Datadog, New Relic (security monitoring)
- **Support Tools**: Intercom, Zendesk (customer support)

All processors have Data Processing Agreements (DPAs) ensuring GDPR/CCPA compliance.

**Business Partners** (with customer consent):
- Benefits administrators
- Insurance companies
- Benefit verification services
- Payroll tax services

**Legal & Government** (as required):
- Law enforcement (with legal process)
- Courts and judges (with court orders)
- IRS and tax authorities (tax compliance)
- Labor departments (labor law compliance)
- Regulators (with lawful requests)

**Data Buyers** (NOT applicable):
- We do NOT sell personal data to third parties
- We do NOT share data for marketing purposes without consent
- We do NOT use data for targeted advertising

### 9.2 Sub-processor Management

**How We Track:**
- Maintain list of all sub-processors
- Published on website or available upon request
- 30-day notice before adding new processor
- Customers have right to object

**Customer Approval:**
- Organizations can request approved processor list
- Can request alternate processor arrangement
- Can restrict processor locations

### 9.3 International Data Transfers

**Cross-Border Transfers:**
- Uses Standard Contractual Clauses (SCC)
- Complies with adequacy decisions
- Enhanced safeguards for EU/UK data
- Regular transfer impact assessments

---

## 10. Data Retention

### 10.1 Retention by Data Type

**Active Employee Data:**
- Retained while employee is employed
- Deleted within 30 days of employment termination
- Exception: Data subject to legal hold retained longer

**Offboarded/Terminated Employees:**
- Retained for 7 years (legal and tax requirement)
- Salary and tax data (W-2, 1099 records) kept 7 years
- Personal identifiable information anonymized after 2 years
- Deleted unless subject to legal hold

**Attendance Records:**
- Retained for 3 years (audit and compliance requirement)
- Can be deleted after 3 years unless under legal hold
- Regular purging process (see Data Retention Policy)

**Leave Records:**
- Retained indefinitely (employee benefit history)
- Essential for disputes and legal claims
- Can be anonymized if employee requests

**Audit Logs:**
- Retained minimum 1 year, recommended 3 years
- Immutable (cannot be modified)
- Separate retention from source data
- Can be archived to cold storage after 1 year

**Support Communications:**
- Retained for 2 years
- Deleted after resolution of support issue
- Can be kept longer if related to legal matter

**Backup Copies:**
- Retained for 90 days (disaster recovery)
- Deleted automatically after 90 days
- Exception: Backups under legal hold retained longer

See Data Retention Policy document for detailed rules.

### 10.2 Automatic Purging

- Scheduled jobs run monthly to identify expired data
- Data marked for deletion flagged 30 days before purge
- Soft delete used (data marked deleted, not physically removed)
- Hard delete occurs after 90-day legal retention period
- Audit trail maintained of all deletions

### 10.3 Legal Holds

- When litigation likely, data placed on legal hold
- All deletion processes suspended
- Data retained until litigation resolved or hold released
- Holds documented and tracked
- Regular review of holds (at least quarterly)

---

## 11. Contact Information

### 11.1 Privacy Inquiries

**General Privacy Questions:**
- Email: privacy@company.com
- Response time: 5-10 business days

**Data Subject Rights Requests:**
- Email: privacy@company.com with "Data Subject Request" in subject
- Include ID verification and detailed request
- Response time: 30 days (may extend 60 days)

**Data Processing Agreements (DPAs):**
- Contact: legal@company.com
- Reference: "DPA Request"
- Processing time: 5 business days

**Breach Notification:**
- Call: 1-800-XXX-XXXX (24/7 hotline)
- Email: security@company.com
- Immediate notification required

### 11.2 Data Protection Officer

**Data Protection Officer (DPO):**
- Email: dpo@company.com
- Mailing Address: DPO, [Company Address]
- Independent oversight of privacy practices
- Confidential complaints accepted

### 11.3 Regulatory Complaints

**EU/UK Residents:**
- Right to lodge complaint with supervisory authority
- Contact your country's data protection authority
- No need to contact us first (but we appreciate early notification)

**California Residents:**
- Can complain to California Attorney General
- See CCPA complaint procedures

**Other Jurisdictions:**
- Contact relevant privacy or data protection authority

### 11.4 Response Commitments

- All inquiries receive response within stated timeframes
- Escalation path available for unresolved issues
- Executive review available upon request
- No retaliation for raising privacy concerns

---

## 12. Policy Changes

### 12.1 Updates to This Policy

- Changes published on our website
- Email notification for material changes
- 30-day advance notice before changes take effect
- Continued use constitutes acceptance of changes

### 12.2 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-11 | Initial publication for Phase 5 |

---

## 13. Acknowledgment

By using our HRMS platform, you acknowledge that you have read and understood this Privacy Policy and agree to our practices regarding your personal data.

For questions, contact: privacy@company.com

---

**Privacy Policy** | **Version 1.0** | **Effective September 11, 2026**

*This policy is part of the HRMS Phase 5 Privacy and Data Retention Implementation*
