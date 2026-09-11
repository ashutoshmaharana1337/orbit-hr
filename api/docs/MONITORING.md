# Monitoring Guide

This document describes the monitoring infrastructure for the HRMS API, including health checks, performance baselines, and alert thresholds.

## Health Check Endpoint

### Endpoint: `GET /api/health`

Returns the health status of the API and its dependencies.

#### Success Response (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2024-09-10T12:34:56.789Z",
  "database": "connected",
  "responseTime": 15
}
```

#### Failure Response (503 Service Unavailable)
```json
{
  "status": "error",
  "timestamp": "2024-09-10T12:34:56.789Z",
  "database": "disconnected",
  "error": "Error: Connection refused",
  "responseTime": 5000
}
```

### Response Fields

- **status**: `"ok"` (healthy) or `"error"` (unhealthy)
- **timestamp**: ISO 8601 timestamp of the health check
- **database**: `"connected"` or `"disconnected"`
- **responseTime**: Response time in milliseconds (0-100ms expected)
- **error**: Error message (only present if status is "error")

## Expected Performance Metrics

### Response Time Baseline

- **Health check endpoint**: < 100ms (database ping included)
- **Standard API endpoints**: < 500ms (95th percentile)
- **Dashboard/aggregation endpoints**: < 1s (data aggregation may be slower)

### Database Performance

- **Connection pool**: 5-20 connections (configurable via DATABASE_URL)
- **Query response time**: < 50ms (typical SELECT)
- **Bulk operations**: < 500ms (batch insert/update)

### Availability Targets

- **Service uptime**: 99.5% (< 3.5 minutes downtime per week)
- **Health check success rate**: 99.9%

## Probes Configuration

### Readiness Probe

Used by container orchestration to determine if the service should receive traffic.

**When to check**: Before the container is marked as "ready"
- Container startup phase
- After configuration changes
- After service restart

**Configuration**:
- Validates database connectivity
- Checks required environment variables
- Used in: Kubernetes readinessProbe, Docker Compose depends_on

### Liveness Probe

Used by container orchestration to determine if the service is still running.

**When to check**: Periodically during normal operation
- Every 30 seconds
- Timeout: 5 seconds
- Failure threshold: 3 consecutive failures = container restart

**Timeline to restart**:
- Initial delay: 15 seconds (allow app startup)
- Check interval: 30 seconds
- Total time before restart: 15s + (3 failures × 35s) = 120 seconds maximum

**Configuration** (Docker):
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
```

**Configuration** (Kubernetes):
```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3001
    scheme: HTTP
  initialDelaySeconds: 30
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1
```

## Alert Thresholds

### Critical (Page On-Call)

- **Health check fails 3x**: Indicates service is down or database is unreachable
- **Continuous 100% error rate**: All requests failing
- **Database connection pool exhaustion**: Cannot accept new connections
- **Unhandled exceptions in application logs**: Critical errors

### Warning (Investigate During Business Hours)

- **Response time > 1 second**: Indicates performance degradation
- **Error rate > 1%**: More than 1% of requests returning errors
- **Memory usage > 80% of limit**: Risk of out-of-memory
- **Database query time > 100ms**: Slow queries detected
- **Disk space < 10% available**: Risk of running out of disk

### Info (Monitor)

- **Response time > 500ms**: Slower than baseline
- **Error rate > 0.1%**: Slight increase in errors
- **Memory usage > 60% of limit**: Approaching warning threshold

## Logs

### Log Format

All logs are output as structured JSON to stdout for container log drivers.

**Log entry structure**:
```json
{
  "level": "info",
  "timestamp": "2024-09-10T12:34:56.789Z",
  "message": "User login successful",
  "requestId": "req-12345",
  "tenantId": "tenant-001",
  "userId": "user-123",
  "userRole": "admin",
  "duration": 145,
  "statusCode": 200,
  "endpoint": "POST /auth/login"
}
```

### Log Levels

- **error**: Critical issues requiring attention (exceptions, failed operations)
- **warn**: Warning conditions (deprecations, unusual but handled situations)
- **info**: Informational messages (login, operations, service start)
- **debug**: Detailed diagnostic information (request details, variable values)

### Log Aggregation

Logs should be aggregated using your platform's log driver:
- **Docker**: Use log drivers (json-file, awslogs, splunk, etc.)
- **Kubernetes**: Use container logs exposed via kubectl logs
- **Railway/Fly.io/Render**: Uses platform's native log aggregation

## Metrics Collection

The API collects basic metrics in-memory:

- **Request count** by endpoint and method
- **Response times** by endpoint (min, max, average)
- **Error rates** by status code and endpoint
- **Database query times**

Metrics are automatically recorded for each request and can be retrieved via:
```
GET /api/metrics (if exposed)
```

### Metrics Retention

- Last 1000 requests per endpoint are kept in memory
- Metrics are reset on application restart
- No persistent storage (use external monitoring tools for long-term analysis)

## Monitoring Tools Integration

### Prometheus (if integrated)

Health check endpoint can be scraped:
```
curl http://localhost:3001/api/health
```

Example Prometheus scrape configuration:
```yaml
scrape_configs:
  - job_name: 'hrms-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/api/health'
```

### Cloud Platform Health Checks

#### Railway.app
Health check is automatically detected from `GET /api/health`
Configure in Railway dashboard: Settings > Health Check

#### Fly.io
Configure in fly.toml:
```toml
[httpService]
  internal_port = 3001
  force_https = false

[[services]]
  protocol = "tcp"
  internal_port = 3001
  ports = [
    { port = 3001, handlers = ["http"], force_https = false }
  ]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    grace_period = "10s"
    interval = 30s
    timeout = "5s"
```

#### Render
Configure in render.yaml:
```yaml
services:
  - type: web
    name: hrms-api
    healthCheckPath: /api/health
    healthCheckInterval: 30
    healthCheckTimeout: 5
```

## Operational Runbook

### Service is down (Health check failing)

1. Check database connectivity
   ```bash
   # From API container
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. Check API logs for errors
   ```bash
   # Docker
   docker logs hrms-api-staging
   
   # Kubernetes
   kubectl logs -n default deployment/hrms-api
   ```

3. Check environment variables
   ```bash
   # Verify DATABASE_URL is set correctly
   env | grep DATABASE
   ```

4. Restart the service
   ```bash
   # Docker
   docker restart hrms-api-staging
   
   # Kubernetes
   kubectl rollout restart deployment/hrms-api -n default
   ```

### High response times (> 1 second)

1. Check database performance
   ```sql
   -- Identify slow queries
   SELECT query, mean_time FROM pg_stat_statements 
   WHERE mean_time > 100 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. Check API logs for slow requests
   ```bash
   # Filter logs for requests > 1000ms
   docker logs hrms-api-staging | grep '"duration":' | grep -E '"duration":[0-9]{4,}'
   ```

3. Check resource utilization
   ```bash
   # Docker stats
   docker stats hrms-api-staging
   ```

4. Consider scaling or optimization
   - Add database indexes
   - Implement caching for aggregations
   - Scale horizontally if load-related

### High error rate (> 1%)

1. Check error logs
   ```bash
   docker logs hrms-api-staging | grep '"level":"error"'
   ```

2. Identify problematic endpoints
   - Check metrics for which endpoints have highest error rates
   - Review recent code changes

3. Check for external service failures
   - Database connectivity
   - Third-party API dependencies
   - Network issues

4. Rollback recent deployments if necessary

## Testing Health Checks

### Local testing
```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Verify response time
curl -w "Response time: %{time_total}s\n" http://localhost:3001/api/health

# Check status code
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health
```

### Docker Compose testing
```bash
# Run health check from service
docker-compose -f docker-compose.staging.yml exec api curl http://localhost:3001/api/health

# Simulate health check failure
docker-compose -f docker-compose.staging.yml exec api pkill -f "node"
docker-compose -f docker-compose.staging.yml ps  # Should show unhealthy
```

### Kubernetes testing
```bash
# Check probe status
kubectl describe pod hrms-api-xxx

# View probe logs
kubectl logs hrms-api-xxx --tail=50

# Test health check endpoint
kubectl port-forward svc/hrms-api 3001:3001
curl http://localhost:3001/api/health
```

## Dashboard Recommendations

For monitoring, set up dashboards showing:

1. **Service Health**
   - Health check status (green/red)
   - Uptime percentage
   - Last health check time

2. **Performance**
   - Response time (current, 5min average, 95th percentile)
   - Request rate (requests/second)
   - Error rate (%)

3. **Resources**
   - Memory usage
   - CPU usage
   - Database connections

4. **Errors**
   - Error count by status code
   - Top 5 error endpoints
   - Error rate trend

## References

- NestJS Docs: https://docs.nestjs.com/
- Docker Health Checks: https://docs.docker.com/engine/reference/builder/#healthcheck
- Kubernetes Probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- PostgreSQL Performance: https://wiki.postgresql.org/wiki/Performance_Optimization
