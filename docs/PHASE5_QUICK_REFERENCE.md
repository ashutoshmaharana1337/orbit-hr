# Phase 5: Uptime Monitoring - Quick Reference

**Quick setup and deployment guide for external uptime monitoring**

## 10-Minute Quick Start

### 1. Verify Health Endpoint (1 minute)

```bash
# Production
curl -i https://api.yourdomain.com/api/health

# Expected Response:
# HTTP/1.1 200 OK
# Content-Type: application/json
# 
# {
#   "status":"ok",
#   "timestamp":"2026-09-11T10:30:45.123Z",
#   "database":"connected",
#   "responseTime":45
# }
```

### 2. Choose Monitoring Service (2 minutes)

| Use Case | Service | Setup Time | Cost |
|----------|---------|-----------|------|
| Small team, public status page | **UptimeRobot** | 5 min | Free-$30/mo |
| Enterprise, advanced alerts | **Pingdom** | 15 min | $10+/mo |
| Full observability stack | **Datadog** | 30 min | $15+/mo |
| Internal only, no cost | **Prometheus** | 1-2 hours | Self-hosted |

**Recommendation for Phase 5**: **UptimeRobot (Free Tier)** or **Pingdom (Professional)**

### 3. Create Monitor (3 minutes)

**UptimeRobot:**
```
URL: https://api.yourdomain.com/api/health
Method: GET
Interval: 5 minutes (free) / 1 minute (paid)
Timeout: 5 seconds
Alert: After 2-3 failures
Channels: Email, Slack
Status Page: Enable
```

**Pingdom:**
```
URL: https://api.yourdomain.com/api/health
Method: HTTP (GET)
Interval: 1 minute
Timeout: 5 seconds
Alert on: Downtime for 2+ minutes
Recipients: on-call@company.com
```

### 4. Configure Alerts (2 minutes)

**Slack Webhook:**
```
#incidents → Connect uptime monitoring
Notification: "API is DOWN"
Retry: 3 consecutive failures
```

**PagerDuty:**
```
Service: HRMS API
Severity: Critical
Escalation: After 15 minutes
```

### 5. Test Alerts (2 minutes)

- Trigger manual test in monitoring service
- Verify Slack notification
- Verify email alert
- Verify SMS alert (P1 only)

## Standard Configuration

### Monitoring Parameters

```yaml
endpoint: GET https://api.yourdomain.com/api/health
check_interval: 60 seconds
timeout: 5 seconds
consecutive_failures: 3  # Before alert triggered
retry_delay: 60 seconds
expected_status: 200
expected_body: "status"
```

### Alert Routing

```
Alert Triggered
    ↓
Slack: #incidents channel
    ↓
Email: on-call-engineers@company.com
    ↓
PagerDuty: Page on-call engineer
    ↓
(After 15 min) SMS: Manager + CTO
```

### SLA Targets

```
Uptime: 99.9% (43 min downtime/month)
Response Time p95: < 500ms
Error Rate: < 0.1%
MTTD: < 3 minutes
MTTR: < 15 minutes
```

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `docs/UPTIME_MONITORING.md` | Complete setup guide (470+ lines) | ✅ Ready |
| `docs/SLA.md` | Service Level Agreement (500+ lines) | ✅ Ready |
| `api/PHASE5_STATUS.md` | Phase 5 completion status | ✅ Ready |
| `api/src/app.controller.ts` | Health endpoint implementation | ✅ Ready |
| `api/src/app.service.ts` | Database connectivity check | ✅ Ready |
| `api/src/common/liveness.config.ts` | Container probe configs | ✅ Ready |
| `api/src/common/readiness.check.ts` | Readiness check script | ✅ Ready |

## Deployment Timeline

```
Day 1: Review documentation
Day 2-3: Set up monitoring service
Day 4: Configure alerts and status page
Day 5: Test alert delivery
Day 6: Validate SLA commitments
Day 7: Team training
Day 8: Production deployment
```

## Critical URLs

- **Health Endpoint**: `https://api.yourdomain.com/api/health`
- **Status Page**: `https://status.yourdomain.com`
- **UptimeRobot**: https://uptimerobot.com
- **Pingdom**: https://www.pingdom.com
- **PagerDuty**: https://pagerduty.company.com

## Key Contacts

| Role | Contact | Response Time |
|------|---------|----------------|
| On-Call Engineer | PagerDuty | 5 min (P1), 30 min (P2) |
| Team Lead | devops-lead@company.com | 15 min |
| Service Director | service-director@company.com | 1 hour |
| Support Email | support@company.com | 24 hours |

## Troubleshooting

### Health Endpoint Returning 503

```bash
# Check database status
psql postgresql://user:pass@host:5432/hrms -c "SELECT 1;"

# Check app logs for errors
docker logs hrms-api

# Restart API container
docker restart hrms-api
```

### Alerts Not Being Sent

```bash
# Verify webhook URL is correct
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert"}'

# Check monitoring service settings
# - Verify email is in recipients list
# - Verify Slack webhook is active
# - Verify PagerDuty integration is enabled
```

### False Positive Alerts

- Increase failure threshold to 3 (not 1)
- Add multiple geographic locations for monitoring
- Check for network latency issues

## Common Tasks

### Test Health Endpoint Manually

```bash
# Simple test
curl https://api.yourdomain.com/api/health

# With timing
curl -w "\nResponse time: %{time_total}s\n" \
  https://api.yourdomain.com/api/health

# With headers
curl -i https://api.yourdomain.com/api/health

# Pretty print JSON
curl https://api.yourdomain.com/api/health | jq .
```

### Simulate Database Failure (Dev/Staging Only)

```bash
# Stop database
docker-compose stop postgres

# Verify health returns 503
curl -i https://staging-api.yourdomain.com/api/health

# Restart database
docker-compose start postgres

# Verify health returns 200
curl -i https://staging-api.yourdomain.com/api/health
```

### Generate Monthly Uptime Report

```bash
# From monitoring service UI:
1. Go to Reports or Dashboard
2. Select date range: Current month
3. View uptime percentage
4. Export as CSV or PDF
5. Send to stakeholders
```

### Create Incident Status Update

```
Template:
  Status: INVESTIGATING / IDENTIFIED / RESOLVED
  Severity: P1 / P2 / P3 / P4
  Start Time: 2026-09-11 10:30:00 UTC
  Duration: 5 minutes
  Impact: API unavailable for 100 users
  Cause: Database connection pool exhausted
  Action: Restarted database connection pool
  ETA: Resolved
```

## Monitoring Service Feature Comparison

### UptimeRobot
✅ Free tier available  
✅ 5-minute intervals (free), 1-minute (paid)  
✅ Public status page included  
✅ Slack integration  
❌ Limited advanced features  

### Pingdom
✅ 1-minute check intervals  
✅ Advanced alerting  
✅ Root cause analysis  
✅ API access  
❌ Paid only (no free tier)  

### Datadog
✅ Full observability platform  
✅ APM integration  
✅ Advanced correlation  
✅ Dashboards  
❌ Higher cost  

### Prometheus
✅ Full control  
✅ No recurring costs  
✅ Open source  
❌ Self-hosted (requires management)  
❌ Limited external monitoring  

## Acceptance Criteria Checklist

- [ ] Health endpoint accessible from public internet
- [ ] Health endpoint returns 200 OK (database connected)
- [ ] Health endpoint returns 503 (database down)
- [ ] Response time < 100ms (typical)
- [ ] Uptime monitor detects failures within 3 minutes
- [ ] Alerts sent to all configured channels
- [ ] On-call engineer receives and acknowledges alert
- [ ] Status page shows correct uptime percentage
- [ ] SLA document signed by authorized representative
- [ ] Team trained on incident response procedures

## Next Steps

1. **Choose monitoring service** → See "Choose Monitoring Service" section
2. **Review complete documentation** → Read `docs/UPTIME_MONITORING.md`
3. **Review SLA** → Read `docs/SLA.md`
4. **Set up monitoring** → Follow service-specific guide
5. **Configure alerts** → Set up Slack, PagerDuty, Email
6. **Test alerts** → Verify delivery to all channels
7. **Enable status page** → Make public and share URL
8. **Deploy to production** → Activate all monitors
9. **Train team** → Conduct incident response training
10. **Collect metrics** → Start tracking uptime for SLA

## Support

For questions or issues:
- Review full documentation: `docs/UPTIME_MONITORING.md`
- Check troubleshooting section
- Contact: devops-lead@company.com
- On-call: PagerDuty incident channel

---

**Phase 5 Status**: ✅ COMPLETE  
**Last Updated**: 2026-09-11  
**Next Review**: 2026-10-11 (Monthly)
