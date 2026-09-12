# Service Level Agreement (SLA)

**HRMS Application - Production Environment**

**Effective Date**: September 11, 2026  
**Version**: 1.0

## 1. Executive Summary

This Service Level Agreement (SLA) defines the service availability, performance, and support commitments for the HRMS (Human Resource Management System) application in production. The agreement establishes the standards for uptime, response times, error rates, and incident response procedures.

## 2. Service Scope

### 2.1 Covered Services

This SLA applies to:
- **HRMS API** (`api.yourdomain.com`)
- **HRMS Web Application** (`app.yourdomain.com`)
- **PostgreSQL Database** (managed backend)

### 2.2 Exclusions

The following are NOT covered by this SLA:
- Customer's network infrastructure and connectivity
- Customer's devices, browsers, or client applications
- Third-party services (email providers, payment processors)
- Maintenance windows (see Section 2.3)
- Issues caused by customer misuse or configuration errors
- Force majeure events (natural disasters, wars, etc.)

### 2.3 Planned Maintenance

- **Frequency**: As needed, typically monthly
- **Advance Notice**: 7 days minimum for critical maintenance, 48 hours for routine updates
- **Typical Window**: Tuesday-Thursday, 02:00-06:00 UTC
- **Downtime Exclusion**: Planned maintenance is excluded from uptime calculation
- **Notification**: Email and status page notification

## 3. Service Availability Targets

### 3.1 Uptime Guarantee

| Service Level | Uptime Target | Downtime Allowed/Month |
|--------------|---------------|----------------------|
| **Standard** | 99.0% | ~7.2 hours |
| **Premium** | 99.5% | ~3.6 hours |
| **Enterprise** | 99.9% | ~43.2 minutes |

**Target (Committed)**: **99.9% uptime** (Enterprise tier)

### 3.2 Uptime Calculation

```
Uptime % = (Total Minutes - Downtime Minutes) / Total Minutes × 100

Where:
  - Total Minutes = Minutes in billing period (excluding planned maintenance)
  - Downtime Minutes = Consecutive minutes of unavailability
  - Unavailable = Service returns HTTP status other than 2xx or times out
```

### 3.3 Measurement Points

- **Primary**: External uptime monitoring (Pingdom/UptimeRobot)
- **Check Interval**: Every 60 seconds
- **Timeout Threshold**: 5 seconds
- **Failure Count**: 3 consecutive failures = downtime period starts
- **Recovery**: 1 successful check = downtime period ends

### 3.4 Downtime Example

- Failure detected: 10:00:00 UTC
- Recovery confirmed: 10:05:30 UTC
- Downtime: 5 minutes 30 seconds
- Impact: ~0.38% of 8-hour incident window

## 4. Performance Targets

### 4.1 Response Time SLA

| Metric | Target | Measurement |
|--------|--------|-------------|
| **p50 (Median)** | < 100ms | 50% of requests faster |
| **p95 (95th Percentile)** | < 500ms | 95% of requests faster |
| **p99 (99th Percentile)** | < 1000ms | 99% of requests faster |
| **Max (Timeout)** | 5000ms | Hard limit |

**Measured**: API requests, monitored via APM (Application Performance Monitoring)

### 4.2 Error Rate SLA

| Error Type | Target | Measurement |
|-----------|--------|-------------|
| **4xx (Client Errors)** | < 2% | Client configuration issues |
| **5xx (Server Errors)** | < 0.1% | Server-side failures |
| **Timeout Rate** | < 0.05% | Requests exceeding 5000ms |

**Measured**: Application logs, monitored via error tracking (Sentry)

### 4.3 Database Performance

| Metric | Target |
|--------|--------|
| **Connection Pool Availability** | 99.9% |
| **Query Response Time (p95)** | < 100ms |
| **Backup Success Rate** | 100% |

## 5. Incident Response & Support

### 5.1 Severity Levels

| Severity | Definition | Response Time | Resolution Target |
|----------|-----------|----------------|------------------|
| **Critical (P1)** | Complete service down, many users affected | 5 minutes | 1 hour |
| **High (P2)** | Significant degradation, some users affected | 15 minutes | 4 hours |
| **Medium (P3)** | Minor issues, workarounds available | 1 hour | 8 hours |
| **Low (P4)** | Cosmetic issues, no user impact | 8 hours | 48 hours |

### 5.2 Response Time Commitment

- **Alert Notification**: Sent to on-call engineer within 1 minute of detection
- **Acknowledgment**: On-call engineer acknowledges within 5 minutes (P1) or 30 minutes (P2-P4)
- **Investigation**: Begin investigation within 15 minutes (P1) or 1 hour (P2-P4)
- **Status Update**: Provided every 30 minutes during incident (P1/P2)

### 5.3 On-Call Support

**24/7 Coverage:**
- On-call engineer available every day
- Rotating weekly schedule
- Backup on-call (secondary)
- Management escalation after 1 hour without progress

**Contact Methods:**
1. Automated alerts (Slack #incidents, Email, SMS for P1)
2. PagerDuty escalation policy
3. Emergency phone number (provided to on-call)

### 5.4 Resolution Definition

**Service is considered RESOLVED when:**
- HTTP 200 response from `/api/health` endpoint
- Database connectivity confirmed
- No errors in application logs for 5 minutes
- Users can successfully perform core workflows
- Status page updated to "All Systems Operational"

## 6. Service Credits (Credits Against Uptime SLA)

### 6.1 Service Credit Policy

If uptime falls below the committed target in a billing month, customers are eligible for service credits:

| Uptime | Service Credit |
|--------|----------------|
| 99.5% - 99.89% | 5% monthly fee |
| 99.0% - 99.49% | 10% monthly fee |
| 98.0% - 98.99% | 25% monthly fee |
| Below 98% | 50% monthly fee |

### 6.2 Credit Request Process

1. **Report**: Customer must report downtime within 30 days of incident
2. **Documentation**: Include incident timestamp, duration, impact
3. **Verification**: Credits issued after verification by DevOps team
4. **Issuance**: Credit applied to next billing cycle

### 6.3 Credit Limitations

- Maximum credits per month: 50%
- Credits do not refund service, they are account credits
- Credits expire 12 months after issuance
- Customer entitled to service credits as sole remedy

## 7. Maintenance & Updates

### 7.1 Planned Maintenance

**Types:**
- Database schema updates
- Server patching and security updates
- Infrastructure scaling
- Feature deployments

**Window:** Tuesday-Thursday, 02:00-06:00 UTC (when possible)

**Notification:**
- 7 days: Initial notification (major changes)
- 2 days: Confirmation notification
- 24 hours: Final reminder
- During: Status page update
- After: Completion notification

**Expected Duration:**
- Routine updates: 15-30 minutes
- Major changes: 1-2 hours
- Emergency fixes: ASAP, notified immediately

### 7.2 Emergency Maintenance

Emergency fixes for critical security issues or data loss prevention:
- Deployed immediately without advance notice
- Notification provided as soon as feasible
- Excluded from uptime calculation
- Post-deployment notification via all channels

### 7.3 Maintenance Exclusion

Planned maintenance (with proper notification) is explicitly excluded from uptime calculations.

## 8. Security & Compliance

### 8.1 Security Commitments

- **Encryption**: All data encrypted in transit (TLS 1.2+) and at rest
- **Authentication**: OAuth 2.0 with JWT tokens, rate limiting on auth endpoints
- **Access Control**: Role-based access control (RBAC) for all resources
- **Audit Logging**: All changes logged with timestamp, user, action
- **Data Privacy**: Compliance with GDPR, CCPA, and local data protection laws

### 8.2 Backup & Disaster Recovery

- **Backup Frequency**: Daily automated backups
- **Retention**: 30 days (configurable)
- **Recovery Time Objective (RTO)**: 1 hour
- **Recovery Point Objective (RPO)**: Less than 1 hour
- **Testing**: Monthly backup recovery drills

### 8.3 Vulnerability Management

- **Scanning**: Weekly automated security scans
- **Patching**: Critical patches deployed within 24 hours
- **Disclosure**: Responsible disclosure for security issues
- **Incident Response**: Security incident response plan in place

## 9. Monitoring & Reporting

### 9.1 Monitoring Infrastructure

- **External Uptime Monitoring**: 5-minute check interval (multiple locations)
- **Application Performance Monitoring**: Continuous APM data collection
- **Error Tracking**: Real-time error monitoring (Sentry)
- **Database Monitoring**: Query performance and connectivity tracking
- **Infrastructure Monitoring**: CPU, memory, disk, network metrics

### 9.2 Reporting

**Monthly Reports:**
- Uptime percentage for the month
- Incident summary (dates, durations, causes)
- Performance metrics (response time p50/p95/p99)
- Error rates and trends
- Backup verification status

**Reports Delivered:**
- Via email to designated contacts
- Available in customer portal
- Historical data: Last 12 months

### 9.3 Public Status Page

- Real-time status: https://status.yourdomain.com
- Uptime history: Last 7/30/90 days
- Incident timeline: With root cause analysis
- Scheduled maintenance: With advance notice
- RSS feed: For integration into customer systems

## 10. Change Management & Release Process

### 10.1 Release Schedule

**Regular Releases:**
- Weekly feature releases: Tuesday 08:00 UTC
- Pre-release testing: Monday (staging environment)
- Rollback plan: Pre-tested and documented
- Release notes: Published 24 hours before release

**Hotfix Releases:**
- For critical bugs or security issues
- Deployed ASAP, potentially outside regular schedule
- Notification via Slack and status page
- Rollback plan prepared before deployment

### 10.2 Testing Before Production

- Unit tests: 100% code coverage for critical paths
- Integration tests: End-to-end workflows tested
- Performance tests: Load testing with expected traffic + 50%
- Security tests: OWASP top 10 coverage
- Staging environment: Identical to production, pre-deployment testing

### 10.3 Rollback Procedures

- **Trigger**: SLA violations, critical bugs, or security issues detected
- **Process**: Automated database backup, code revert, health check verification
- **Communication**: Incident notification with explanation
- **Time**: Rollback completed within 5 minutes of decision

## 11. Responsibilities

### 11.1 Provider Responsibilities (HRMS Service Team)

- Maintain infrastructure and databases
- Deploy and monitor applications
- Respond to incidents within SLA times
- Provide 24/7 on-call support
- Monthly uptime and incident reports
- Security patching and updates
- Backup and disaster recovery

### 11.2 Customer Responsibilities

- Maintain proper authentication credentials
- Use HTTPS for all API calls
- Implement proper error handling
- Report issues promptly with details
- Maintain customer-side infrastructure
- Comply with acceptable use policy
- Keep API integration up to date

## 12. Escalation Procedures

### 12.1 Escalation Levels

**Level 1: Initial Response (0-30 minutes)**
- On-call engineer responds and investigates
- Communicates findings to customer
- Attempts mitigation or fix

**Level 2: Manager Escalation (30-60 minutes)**
- If Level 1 cannot resolve or reproduce issue
- Engineering team lead reviews
- Additional resources allocated

**Level 3: Director Escalation (1-2 hours)**
- If incident still unresolved after Level 2
- Service director becomes involved
- Considers mitigation options (feature flags, traffic diversion)

**Level 4: Executive Escalation (2+ hours)**
- If incident continues affecting SLA
- CTO/VP Engineering involved
- Activation of disaster recovery plan if needed

### 12.2 Escalation Contacts

- **L1 On-Call**: [PagerDuty escalation policy]
- **L2 Manager**: eng-team-leads@company.com
- **L3 Director**: service-director@company.com
- **L4 Executive**: cto@company.com

## 13. Incident Post-Mortem

### 13.1 Post-Mortem Trigger

Post-mortems are conducted for:
- Any P1 (Critical) incident
- P2 incidents lasting > 30 minutes
- Incidents affecting SLA target
- Security incidents
- Any customer escalation

### 13.2 Post-Mortem Process

1. **Timeline**: 24 hours after incident resolution
2. **Participants**: On-call, engineer, manager, affected teams
3. **Documentation**: Root cause, timeline, contributing factors
4. **Action Items**: Preventive measures to avoid recurrence
5. **Sharing**: Post-mortem summary shared with customer (without sensitive details)

### 13.3 Follow-up

- Action items tracked in project management system
- Implementation of preventive measures within 1 week
- Follow-up verification within 2 weeks
- Trend analysis for recurring issues

## 14. Communication Policy

### 14.1 During Incident

- **Initial Notification**: Within 1 minute of detection (P1), 15 minutes (P2)
- **Frequency**: Every 30 minutes (P1/P2), or upon significant change
- **Channels**: Slack #incidents, Email, SMS (P1 only)
- **Communication**: Honest assessment, no speculation
- **Updates**: Continue until service fully recovered

### 14.2 Post-Incident

- **Incident Report**: Within 24 hours
- **Summary**: What happened, duration, customer impact
- **Root Cause**: Technical analysis
- **Prevention**: Steps taken to prevent recurrence
- **Post-Mortem**: Shared with customer within 3 business days

## 15. Service Restrictions & Limitations

### 15.1 Acceptable Use

Customers must not:
- Use service for illegal activities
- Launch DDoS attacks or security tests without approval
- Reverse engineer or bypass security controls
- Store confidential third-party data without consent
- Send spam or unsolicited communications
- Resell service or provide to unauthorized users

### 15.2 Rate Limiting

- **Default**: 120 requests/minute per authenticated user
- **Auth Endpoints**: 5 requests/minute (login, register)
- **Burst**: 1000 requests/minute (short bursts allowed)
- **Overages**: HTTP 429 (Too Many Requests)

### 15.3 Data Retention

- **Active Data**: Retained during service subscription
- **Deleted Records**: Soft-deleted for 30 days, then permanently removed
- **Backup Data**: Retained for 30 days after deletion
- **Audit Logs**: Retained for 90 days

## 16. Pricing & Billing

### 16.1 Service Tiers

| Tier | Users | API Calls | Support | Uptime SLA | Cost |
|------|-------|-----------|---------|-----------|------|
| **Starter** | 50 | 100K/month | Business hours | 99.0% | $299/month |
| **Professional** | 200 | 1M/month | 24/7 | 99.5% | $999/month |
| **Enterprise** | Unlimited | Unlimited | 24/7 Dedicated | 99.9% | Custom |

### 16.2 Billing Cycle

- **Period**: Monthly (calendar month)
- **Invoice**: Due within 30 days
- **Payment**: Credit card, ACH, wire transfer
- **Late Fees**: 1.5% monthly interest on unpaid balance

## 17. Service Termination

### 17.1 Customer Termination

- 30-day notice required
- Data export window: 30 days after termination
- Billing: Through last day of service
- Data deletion: Complete removal after 90 days

### 17.2 Provider Termination

- 90-day notice for customer violation of terms
- Immediate termination for illegal activity
- Data export and deletion per customer request
- Refund: Pro-rata for unused service (if applicable)

## 18. Amendment & Review

### 18.1 SLA Review

- **Frequency**: Quarterly review with key customers
- **Changes**: Announced 30 days in advance
- **Improvement**: SLA targets may improve, not decrease (without customer consent)
- **Version Control**: All versions maintained in git repository

### 18.2 Effective Date of Changes

- 30-day notice period
- Customers may opt-out before effective date
- Amendment automatically accepted if customer continues service

## 19. Glossary

| Term | Definition |
|------|-----------|
| **Downtime** | Period when service is unavailable (HTTP 503 or timeout) |
| **Availability** | Percentage of time service is available during billing period |
| **MTTD** | Mean Time To Detect - average time to detect incident |
| **MTTR** | Mean Time To Recovery - average time to restore service |
| **RTO** | Recovery Time Objective - maximum acceptable downtime |
| **RPO** | Recovery Point Objective - maximum acceptable data loss |
| **p50/p95/p99** | Response time percentiles (50th, 95th, 99th) |
| **Incident** | Any event that affects service availability or performance |
| **Maintenance** | Planned activity to improve service (excluded from SLA) |

## 20. Contact Information

### 20.1 Support Contacts

- **General Support**: support@company.com
- **Incident Hotline**: incidents@company.com
- **Security Issues**: security@company.com
- **Billing**: billing@company.com
- **Sales**: sales@company.com

### 20.2 Status & Updates

- **Status Page**: https://status.yourdomain.com
- **Twitter**: @yourcompany_status
- **Email List**: Subscribe at https://yourdomain.com/status
- **RSS Feed**: https://status.yourdomain.com/feeds

## Signature

This Service Level Agreement is effective as of September 11, 2026 and supersedes all previous agreements.

**For HRMS Service Team:**

- **Approved By**: _________________ (Service Director)
- **Date**: _________________

**For Customer Organization:**

- **Authorized By**: _________________ (Authorized Representative)
- **Date**: _________________

---

**Document Version**: 1.0  
**Last Updated**: 2026-09-11  
**Status**: Active - Phase 5 Implementation  
**Review Schedule**: Quarterly

**References:**
- [Uptime Monitoring Setup Guide](./UPTIME_MONITORING.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Incident Response Procedures](./UPTIME_MONITORING.md#alert-response-procedure)
