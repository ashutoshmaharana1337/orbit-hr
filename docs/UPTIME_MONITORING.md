# Uptime Monitoring Setup Guide

**Phase 5 Implementation**

## Overview

External uptime monitoring ensures that the HRMS application availability is continuously tracked from outside the infrastructure. This guide covers implementation, configuration, and alert management for multiple uptime monitoring services.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Service Options Comparison](#service-options-comparison)
3. [Health Check Endpoint Verification](#health-check-endpoint-verification)
4. [Service-Specific Configuration](#service-specific-configuration)
5. [Alert Configuration](#alert-configuration)
6. [Public Status Page](#public-status-page)
7. [Integration with Observability](#integration-with-observability)
8. [Troubleshooting](#troubleshooting)
9. [Testing Procedures](#testing-procedures)

## Quick Start

The HRMS API exposes a health check endpoint at `GET /api/health` that provides:

- **Endpoint**: `https://api.yourdomain.com/api/health`
- **Method**: GET
- **Expected Status**: 200 OK
- **Response Time**: < 100ms (typical)
- **Check Interval**: Every 60 seconds
- **Timeout**: 5 seconds
- **Consecutive Failures to Alert**: 3

### Minimal Configuration

```json
{
  "monitor_type": "HTTP_GET",
  "url": "https://api.yourdomain.com/api/health",
  "expected_status": 200,
  "timeout_seconds": 5,
  "check_interval_seconds": 60,
  "failure_threshold": 3,
  "notification_channels": ["email", "slack", "pagerduty"]
}
```

## Service Options Comparison

### 1. UptimeRobot (Recommended for SMBs)

**Pros:**
- Free tier with 50 monitors
- Simple, intuitive web interface
- Public status page included
- 5-minute check intervals on free tier
- Slack integration built-in
- Email alerts
- No credit card required for free tier

**Cons:**
- Free tier has 5-minute minimum interval (not 60 seconds)
- Limited historical data on free tier
- Dashboard customization limited

**Best For:** Small to medium teams, public-facing status page preferred

**Pricing:**
- Free: 50 monitors, 5-min intervals
- Professional: $9.99/month
- Business: $29.99/month

### 2. Pingdom

**Pros:**
- 60-second check intervals available
- Advanced alerting options
- Root cause analysis
- Public incident reporting
- Integration with many tools (PagerDuty, Slack, etc.)
- Comprehensive reporting and analytics

**Cons:**
- Paid only (no free tier)
- More complex setup
- Steeper learning curve

**Best For:** Enterprise deployments, complex incident management

**Pricing:**
- Standard: $9.99/month
- Professional: $99/month
- Enterprise: Custom pricing

### 3. Datadog

**Pros:**
- Full observability platform (logs, metrics, traces, uptime)
- Unified dashboard for all monitoring
- Advanced alerting and correlation
- Synthetics testing capabilities
- Correlation with application errors
- Enterprise features (custom roles, audit logs)

**Cons:**
- Expensive for uptime monitoring alone
- Steeper learning curve
- Requires agent for full features (not needed for HTTP checks)

**Best For:** Teams already using Datadog, need full observability

**Pricing:**
- Infrastructure: $15/host/month
- APM: $40/host/month (includes uptime)
- Synthetics: $0.05 per synthetic check

### 4. Self-Hosted Prometheus + Alertmanager

**Pros:**
- Full control over monitoring
- No recurring subscription costs
- Flexible alerting rules
- Integration with existing Prometheus setup
- Open source and transparent

**Cons:**
- Requires infrastructure to run
- No external monitoring (unless you set up separate instance)
- Maintenance overhead
- External network required for external monitoring

**Best For:** Teams with DevOps expertise, cost-sensitive, no external uptime needed

**Pricing:** Self-hosted (infrastructure costs only)

## Service Comparison Matrix

| Feature | UptimeRobot | Pingdom | Datadog | Prometheus |
|---------|-------------|---------|---------|------------|
| Check Interval | 5m (free) | 1m | 1m | 1m |
| Cost | Free/Paid | Paid | Paid | Self-hosted |
| Public Status Page | Yes | Yes | No | No |
| Slack Integration | Yes | Yes | Yes | Yes |
| PagerDuty Integration | Yes | Yes | Yes | Yes |
| API | Yes | Yes | Yes | Yes |
| Setup Time | 5 min | 15 min | 30 min | 1-2 hours |
| Best For | SMBs | Enterprises | Full Observability | Internal Teams |

## Health Check Endpoint Verification

### Implementation Status

The health check endpoint is implemented in `api/src/app.controller.ts`:

```typescript
@Get('health')
@HttpCode(200)
async health() {
  const result = await this.appService.health();
  
  // Return 503 if database is not connected
  if (result.status !== 'ok') {
    throw new ServiceUnavailableException(result);
  }
  
  return result;
}
```

### Database Connectivity Check

The health check hits the database with a simple query:

```typescript
async health() {
  const startTime = Date.now();
  try {
    // Ping the database with a simple query
    await this.prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: (error as Error).message,
      responseTime,
    };
  }
}
```

### Response Examples

**Healthy (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-11T10:30:45.123Z",
  "database": "connected",
  "responseTime": 45
}
```

**Unhealthy (503 Service Unavailable):**
```json
{
  "statusCode": 503,
  "message": "Service Unavailable",
  "error": "Error: connect ECONNREFUSED 127.0.0.1:5432"
}
```

### Verification Steps

1. **Local Testing:**
   ```bash
   curl -v http://localhost:3001/api/health
   ```

2. **Production Testing:**
   ```bash
   curl -v https://api.yourdomain.com/api/health
   ```

3. **Response Time Check:**
   ```bash
   time curl -s https://api.yourdomain.com/api/health | jq .responseTime
   ```

4. **Failure Simulation (Development Only):**
   - Stop the database
   - Verify endpoint returns 503
   - Restart database
   - Verify endpoint returns 200

## Service-Specific Configuration

### UptimeRobot Setup

1. **Sign Up/Login**
   - Go to https://uptimerobot.com
   - Create account or login

2. **Create Monitor**
   - Click "Add New Monitor"
   - Select "HTTP(s)" as monitor type
   - Name: "HRMS API Health"
   - URL: `https://api.yourdomain.com/api/health`
   - Check interval: Professional plan or higher for 60 seconds

3. **Configure Alerts**
   - Failure notification: "After 2 consecutive failures"
   - Alert channels:
     - Email: your-team@company.com
     - Slack (Premium): Connect to Slack workspace
     - Webhook: Optional custom webhook

4. **Public Status Page**
   - Click "Public Status Page"
   - Customize branding
   - Get shareable URL
   - Enable RSS feed
   - Share with customers: `https://stats.yourdomain.com`

### Pingdom Setup

1. **Sign Up/Login**
   - Go to https://www.pingdom.com
   - Create account

2. **Create HTTP Check**
   - Uptime menu → New Check
   - Check type: HTTP
   - URL: `https://api.yourdomain.com/api/health`
   - Check interval: 1 minute (Standard plan)
   - Timeout: 5 seconds
   - Team: Select your team
   - Save check

3. **Configure Alerts**
   - Alerts → New Alert Policy
   - Trigger: "Check Down"
   - Down for: 2 minutes (allows 3 failures)
   - Notification type: Email + Slack (if enabled)
   - Recipients: on-call-engineers@company.com

4. **Public Status Page**
   - Reports → Public Status Page
   - Enable and customize
   - Get shareable URL
   - Add to customer documentation

5. **API Integration**
   - Generate API token in Settings
   - Store in secrets manager
   - Use for automated monitoring management

### Datadog Setup

1. **Add Uptime Monitor**
   - Monitors → Synthetics
   - New Synthetic Test
   - Type: API test
   - URL: `https://api.yourdomain.com/api/health`
   - Request method: GET
   - Assertions:
     - Response time < 500ms
     - Status code is 200
     - Response body contains "ok"

2. **Configure Check**
   - Test frequency: 1 minute
   - Number of locations: Select 3+ (global monitoring)
   - Allow retries: true
   - Retry interval: 1 minute

3. **Set Alerts**
   - Alert when: "down for 3 minutes"
   - Notify: on-call-engineers
   - Include: Environment, service, version tags

4. **Custom Dashboard**
   - Create dashboard
   - Add uptime check widget
   - Add related metrics (API latency, errors)
   - Share with team

### Prometheus Setup (Self-Hosted)

1. **Install Prometheus + Alertmanager**
   ```bash
   docker run -d \
     --name prometheus \
     -p 9090:9090 \
     -v prometheus.yml:/etc/prometheus/prometheus.yml \
     prom/prometheus
   ```

2. **Configure prometheus.yml**
   ```yaml
   global:
     scrape_interval: 60s
     evaluation_interval: 60s
   
   scrape_configs:
     - job_name: 'hrms-health'
       metrics_path: '/api/health'
       static_configs:
         - targets: ['api.yourdomain.com:443']
       scheme: https
       scrape_interval: 60s
       scrape_timeout: 5s
   
   alerting:
     alertmanagers:
       - static_configs:
           - targets: ['localhost:9093']
   
   rule_files:
     - 'alert_rules.yml'
   ```

3. **Alert Rules (alert_rules.yml)**
   ```yaml
   groups:
     - name: hrms
       rules:
         - alert: HRMSDown
           expr: up{job="hrms-health"} == 0
           for: 3m
           annotations:
             summary: "HRMS API is down"
             description: "HRMS health check failed for 3 minutes"
   ```

4. **Alertmanager Configuration**
   ```yaml
   global:
     resolve_timeout: 5m
   
   route:
     receiver: 'team-notifications'
     group_by: ['alertname', 'job']
     group_wait: 1m
     group_interval: 5m
     repeat_interval: 12h
   
   receivers:
     - name: 'team-notifications'
       email_configs:
         - to: 'on-call@company.com'
           from: 'alerts@company.com'
       slack_configs:
         - api_url: 'YOUR_SLACK_WEBHOOK'
           channel: '#incidents'
   ```

## Alert Configuration

### Alert Thresholds

**Recommended Settings:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Consecutive Failures** | 3 (180 seconds total with 60s interval) | Alert triggered |
| **Response Time** | > 1000ms | Warning logged |
| **Response Time** | > 5000ms | Alert triggered |
| **Error Rate** | > 0% for 5 minutes | Alert triggered |

### Notification Channels

1. **Email**
   - Recipients: on-call-engineers@company.com, devops-team@company.com
   - Subject: `[CRITICAL] HRMS API Down - Immediate Action Required`
   - Include: Timestamp, last status, response time

2. **Slack**
   - Channel: #incidents
   - Severity: 🔴 Critical
   - Include: Service name, endpoint, failure reason
   - Mention: @on-call

3. **PagerDuty Integration**
   - Service: HRMS API
   - Severity: Critical
   - Auto-escalate: After 15 minutes
   - Escalation policy: On-call engineer → Manager → CTO

4. **SMS (Optional)**
   - For critical incidents (downtime > 15 minutes)
   - Primary recipients: On-call engineer, manager
   - Message: "HRMS API is down. Check Slack #incidents for details."

### Alert Response Procedure

1. **Alert Received (T+0min)**
   - Check #incidents Slack channel for details
   - Verify alert is not false positive (test, maintenance, etc.)
   - Acknowledge in monitoring system (prevent escalation)

2. **Investigation (T+0-5min)**
   - Check health endpoint manually: `curl https://api.yourdomain.com/api/health`
   - Check application logs for errors
   - Check database connectivity and load
   - Check infrastructure status (CPU, memory, disk)

3. **Incident Response (T+5-15min)**
   - If service is up but endpoint returns error: Check database
   - If database is down: Page DBA or restart database
   - If infrastructure issue: Contact infrastructure team
   - Update #incidents channel with status

4. **Recovery (T+15min+)**
   - Once service recovers, verify with multiple endpoint checks
   - Review incident logs
   - Post-mortem if critical incident
   - Document root cause and prevention

### On-Call Schedule

- **Primary On-Call**: Engineering team (rotating weekly)
- **Secondary On-Call**: Team lead (backup)
- **Management Escalation**: After 30 minutes
- **Rotation**: Every Monday at 00:00 UTC
- **Schedule**: https://pagerduty.company.com/schedules/hrms

## Public Status Page

### Purpose

Share service availability with customers and stakeholders in real-time.

### Recommended Content

1. **Current Status**
   - "All Systems Operational" or list of affected services
   - Real-time status indicator
   - Last updated timestamp

2. **Uptime History**
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Uptime percentage: Target 99.9%

3. **Recent Incidents**
   - Date and time
   - Duration
   - Root cause (once determined)
   - Resolution taken

4. **Scheduled Maintenance**
   - Planned maintenance windows
   - Expected duration
   - Services affected
   - Notification sent at least 48 hours before

### Configuration by Service

**UptimeRobot:**
- Public Status Page: Enabled
- Custom domain: `status.yourdomain.com` (via CNAME)
- Branding: Company logo, colors
- Enable RSS: Yes

**Pingdom:**
- Status Page: Enable and configure
- Custom URL: `status.yourdomain.com`
- Components listed: API, Web, Database
- Display uptime graphs: Yes

**Datadog:**
- Create public dashboard
- Configure permissions: Read-only public
- Share link (no authentication required)
- Monitor list: Uptime checks

### Sharing with Customers

1. Add to company website footer
   ```html
   <footer>
     <a href="https://status.yourdomain.com" target="_blank">
       Service Status
     </a>
   </footer>
   ```

2. Include in documentation
   ```markdown
   Check [service status](https://status.yourdomain.com) for real-time availability
   ```

3. Email to important customers
   - "Here's where you can monitor HRMS availability"
   - Include in customer onboarding documentation

## Integration with Observability

### Correlation with Application Errors

1. **Datadog APM Integration**
   - Link uptime check results to error spikes
   - Create composite alerts: "Uptime down AND error rate high"
   - Dashboard widget: "Uptime vs Error Rate"

2. **Sentry Integration**
   - Uptime check failure → Auto-create issue
   - Correlate with error patterns
   - Track incidents across services

3. **Grafana Integration**
   - Display uptime alongside application metrics
   - Alerting rules: Combine uptime + performance metrics
   - Dashboard: Health overview

### Metrics to Track

1. **Availability Metrics**
   - Uptime percentage (99.9% target)
   - Mean time to detection (MTTD): < 3 minutes
   - Mean time to recovery (MTTR): < 15 minutes

2. **Performance Metrics**
   - Response time (p50, p95, p99)
   - Timeout rate
   - Error rate

3. **Incident Metrics**
   - Incidents per month
   - Average incident duration
   - Root causes: Infrastructure vs Code

### Historical Tracking

1. **Monthly Reports**
   - Uptime percentage
   - Incidents: Date, duration, cause, resolution
   - Performance trends
   - SLA compliance

2. **Trend Analysis**
   - Uptime trend (improving? declining?)
   - Incident frequency trend
   - Response time trend
   - Identify patterns

## Troubleshooting

### Common Issues and Solutions

1. **False Positive Alerts**
   - **Symptom**: Alert triggered but service is up
   - **Cause**: Network timeout, transient glitch
   - **Solution**: Set failure threshold to 3 consecutive failures (not 1)
   - **Verify**: Check multiple uptime monitors in different regions

2. **Health Endpoint Timeout**
   - **Symptom**: Uptime monitor reports timeout
   - **Cause**: Database slow, connection pool exhausted, network issue
   - **Solution**:
     - Check database response time: `curl -w "@curl-format.txt" https://api.yourdomain.com/api/health`
     - Check database connections: `SELECT count(*) FROM pg_stat_activity;`
     - Increase timeout to 10 seconds temporarily

3. **Health Endpoint Returns Wrong Status**
   - **Symptom**: Uptime monitor shows down, but manual curl shows 200
   - **Cause**: Network differences, monitoring location specific
   - **Solution**:
     - Add monitoring from multiple geographic locations
     - Check if issue is intermittent
     - Review application logs for errors

4. **Database Connection Issues**
   - **Symptom**: Health endpoint returns 503 "database disconnected"
   - **Cause**: Database down, connection string wrong, network blocked
   - **Solution**:
     - Verify database is running and accessible
     - Check CONNECTION_STRING environment variable
     - Verify firewall rules allow database access
     - Check database user permissions

5. **Missing or Delayed Alerts**
   - **Symptom**: Service down but no alert received
   - **Cause**: Alert disabled, wrong recipients, notification channel issue
   - **Solution**:
     - Verify alert rule is enabled
     - Check notification channel credentials (Slack webhook, email)
     - Test alert manually by triggering failure simulation
     - Check alert logs in monitoring service

### Testing Alert Delivery

1. **Trigger False Downtime (UptimeRobot)**
   - Change URL to invalid endpoint
   - Wait for failure threshold (usually 3 checks)
   - Verify alert received
   - Fix URL

2. **Trigger False Downtime (Pingdom)**
   - Edit check, change URL to invalid
   - Wait for alert
   - Verify notification received
   - Restore correct URL

3. **Verify Slack Webhook**
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test alert"}' \
     YOUR_SLACK_WEBHOOK_URL
   ```

4. **Verify Email Alerts**
   - Use monitoring service test alert feature
   - Check spam folder
   - Verify email is not filtered

## Testing Procedures

### Manual Testing

1. **Health Endpoint Response**
   ```bash
   # Production
   curl -v https://api.yourdomain.com/api/health
   
   # Expected output:
   # < HTTP/1.1 200 OK
   # {"status":"ok",...}
   ```

2. **Response Time Measurement**
   ```bash
   curl -w "Total: %{time_total}s, Connect: %{time_connect}s\n" \
     -o /dev/null -s https://api.yourdomain.com/api/health
   ```

3. **Simulate Database Failure (Dev/Staging Only)**
   ```bash
   # Connect to database
   docker exec hrms-postgres pg_isready
   
   # Stop database
   docker stop hrms-postgres
   
   # Verify health endpoint returns 503
   curl -i https://api.yourdomain.com/api/health
   # Expected: HTTP/1.1 503 Service Unavailable
   
   # Restart database
   docker start hrms-postgres
   
   # Verify health endpoint returns 200
   curl -i https://api.yourdomain.com/api/health
   # Expected: HTTP/1.1 200 OK
   ```

### Automated Testing

1. **CI/CD Health Check Test**
   ```bash
   #!/bin/bash
   
   # After deployment, verify health endpoint
   MAX_RETRIES=10
   RETRY_COUNT=0
   
   while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
     RESPONSE=$(curl -s https://api.yourdomain.com/api/health)
     STATUS=$(echo $RESPONSE | jq -r '.status')
     
     if [ "$STATUS" == "ok" ]; then
       echo "Health check passed"
       exit 0
     fi
     
     RETRY_COUNT=$((RETRY_COUNT + 1))
     sleep 5
   done
   
   echo "Health check failed after $MAX_RETRIES attempts"
   exit 1
   ```

2. **Monitor Alert Test (Monthly)**
   - First Monday of each month
   - Simulate health endpoint failure in staging
   - Verify alert is triggered
   - Verify notification received
   - Document test results

### Acceptance Criteria

- [ ] Health endpoint responds with 200 OK when database is healthy
- [ ] Health endpoint responds with 503 when database is down
- [ ] Response time is consistently under 100ms
- [ ] Uptime monitor successfully pings endpoint every 60 seconds
- [ ] Alert is triggered after 3 consecutive failures (3 minutes)
- [ ] Alert notifications delivered to all channels within 1 minute
- [ ] On-call engineer receives and acknowledges alert
- [ ] Public status page displays correct uptime percentage
- [ ] Service recovery is reflected in status page within 5 minutes

## References

- [Health Endpoint Implementation](../api/src/app.controller.ts)
- [Service Level Agreement](./SLA.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Production Hardening Guide](./07-production-hardening.md)

---

**Document Version**: 1.0  
**Last Updated**: 2026-09-11  
**Status**: Active - Phase 5 Implementation  
**Maintained By**: DevOps Team
