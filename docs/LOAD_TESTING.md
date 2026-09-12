# Load Testing Guide - Phase 5

## Overview

This guide covers load testing the HRMS system at scale (2,000+ employees). Load testing ensures the system can handle production-level concurrency and validates performance baselines.

## Quick Start

### 1. Seed Test Database

```bash
# Create 2,000 employees with 5 years of historical data
./scripts/seed-load-test.sh --employees 2000 --years 5

# With custom parameters
./scripts/seed-load-test.sh --employees 5000 --years 10
```

**Output**:
- 2,000+ employees distributed across departments
- 5 years of attendance records (~250,000+ records)
- ~6,000 leave requests
- Test admin account: `loadtest.admin@loadtest.dev` (password: `password123`)

### 2. Start API and Database

```bash
# Using Docker Compose
docker-compose -f docker-compose.staging.yml up -d

# Wait for services to be ready
sleep 10

# Verify API is running
curl http://localhost:3001/api/health
```

### 3. Get Authentication Token

```bash
# Login with test admin account
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "loadtest.admin@loadtest.dev",
    "password": "password123"
  }'

# Extract the token from response (store as $TOKEN)
```

### 4. Run Load Test

```bash
# Basic load test (100 VUs for 9 minutes)
./scripts/run-load-test.sh \
  --api-url http://localhost:3001/api \
  --token $TOKEN

# Custom output directory
./scripts/run-load-test.sh \
  --api-url http://localhost:3001/api \
  --token $TOKEN \
  --output ./my-load-test-results

# Verbose output
./scripts/run-load-test.sh \
  --api-url http://localhost:3001/api \
  --token $TOKEN \
  --verbose
```

### 5. Review Results

```bash
# Results stored in: ./load-test-results/

# View latest JSON report
cat load-test-results/results_*.json | jq '.metrics'

# View summary from log
grep -E "http_reqs|http_req_duration|http_req_failed" load-test-results/run_*.log
```

## Load Test Scenarios

### Scenario 1: Heavy List Operations (30% of traffic)

Tests pagination and filtering on large employee lists.

**Endpoints**:
- GET /employees?limit=20
- GET /employees?limit=50
- GET /employees?limit=100

**Expected**:
- 100% success rate
- p95 < 500 ms
- Handles 2,000+ records with cursor pagination

### Scenario 2: Dashboard & Trends (30% of traffic)

Tests aggregate calculations at scale.

**Endpoints**:
- GET /dashboard/stats
- GET /attendance/trend?days=7
- GET /attendance/summary

**Expected**:
- Dashboard stats: < 200 ms p95
- Trend: < 300 ms p95
- Summary: < 150 ms p95

### Scenario 3: Attendance Operations (20% of traffic)

Tests historical attendance data queries.

**Endpoints**:
- GET /attendance/today
- GET /attendance/trend?days=7

**Expected**:
- Today's attendance: < 400 ms p95
- Multiple concurrent trend queries handled efficiently

### Scenario 4: Leave Operations (10% of traffic)

Tests leave request listing and creation.

**Endpoints**:
- GET /leave?limit=50
- POST /leave

**Expected**:
- List: < 300 ms p95
- Create: < 200 ms p95
- < 1% write errors

### Scenario 5: Mixed Operations (10% of traffic)

Tests realistic user patterns combining multiple operations.

**Endpoints**:
- GET /employees
- GET /employees/:id
- GET /dashboard/stats
- All of the above in sequence

## Performance Analysis

### Reading k6 JSON Report

k6 outputs detailed metrics in JSON format:

```bash
# Pretty print the report
cat load-test-results/results_*.json | jq '.metrics | keys'

# Extract specific metrics
cat load-test-results/results_*.json | jq '.metrics.http_req_duration'

# Filter by endpoint
cat load-test-results/results_*.json | jq '.metrics[] | select(.name | contains("/employees"))'
```

### Key Metrics to Review

1. **http_req_duration**: Response times
   ```
   {
     avg: 150,
     min: 20,
     max: 850,
     med: 120,
     p(50): 120,
     p(95): 380,
     p(99): 520
   }
   ```

2. **http_req_failed**: Error count
   ```
   {
     rate: 0.002  // 0.2% error rate
   }
   ```

3. **http_reqs**: Total requests
   ```
   {
     count: 5432  // Total requests made
   }
   ```

4. **vus**: Virtual users
   ```
   {
     value: 100  // Peak VU count
   }
   ```

### Comparing Against Baselines

Check results in [PERFORMANCE_BASELINES.md](./PERFORMANCE_BASELINES.md):

```bash
# Response time comparison
echo "Baseline p95: 380 ms"
echo "Actual p95:   $(cat load-test-results/results_*.json | jq '.metrics.http_req_duration["p(95)"]')"

# Error rate comparison
echo "Baseline error: < 1%"
echo "Actual error:   $(cat load-test-results/results_*.json | jq '.metrics.http_req_failed.rate * 100')"
```

## Troubleshooting Performance Issues

### Slow Response Times (p95 > baseline + 50%)

1. **Check database query performance**:
   ```sql
   -- Enable query logging
   SET log_min_duration_statement = 100; -- log queries > 100ms
   
   -- Analyze slow query
   EXPLAIN ANALYZE SELECT ... ;
   ```

2. **Check index usage**:
   ```sql
   -- View index usage
   SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
   
   -- Verify expected indexes exist
   SELECT indexname FROM pg_indexes WHERE tablename = 'employee';
   ```

3. **Check for N+1 queries**:
   - Review service code for loops with database queries
   - Use DataLoader or batch operations
   - Verify includes/relations are used correctly

4. **Optimize pagination**:
   - Ensure cursor indexes exist
   - Use `take: limit + 1` pattern for hasMore calculation
   - Test with different page sizes

### High Error Rate (> 1%)

1. **Check authentication**:
   ```bash
   # Verify token is valid
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/employees
   ```

2. **Check validation**:
   - Review DTO validation rules
   - Ensure payload format matches expectations

3. **Check server logs**:
   ```bash
   docker-compose -f docker-compose.staging.yml logs -f api
   ```

4. **Check database connectivity**:
   ```sql
   -- Verify connection pool
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check for connection errors
   SELECT datname, state, count(*) FROM pg_stat_activity GROUP BY datname, state;
   ```

### Database Connection Pool Exhaustion

1. **Check current connections**:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

2. **Increase pool size** in `.env`:
   ```
   DATABASE_POOL_SIZE=20
   DATABASE_POOL_TIMEOUT=5000
   ```

3. **Reduce query duration**:
   - Optimize slow queries
   - Add indexes
   - Use connection pooling middleware

4. **Use PgBouncer** for connection pooling at database level

## Advanced Testing Scenarios

### Spike Test (Gradual Ramp)

Test behavior under sudden traffic increase:

```javascript
// Modify api/tests/load-test.js stages
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp to 50 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '1m', target: 250 },  // Spike to 250 users
    { duration: '1m', target: 500 },  // Spike to 500 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
};
```

Run: `./scripts/run-load-test.sh --token $TOKEN`

### Stress Test (High Load)

Test system limits:

```bash
# Custom k6 script for stress testing
cat > /tmp/stress-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 1000 },  // Ramp to 1000 users
    { duration: '10m', target: 1000 }, // Hold for 10 minutes
    { duration: '5m', target: 0 },     // Ramp down
  ],
};

export default function() {
  const response = http.get('http://localhost:3001/api/dashboard/stats');
  check(response, { 'status is 200': (r) => r.status === 200 });
}
EOF

k6 run /tmp/stress-test.js
```

### Soak Test (Long Duration)

Test system stability over time:

```bash
# 24-hour soak test at sustained load
k6 run \
  --stage 1h:100 \
  --stage 22h:100 \
  --stage 1h:0 \
  api/tests/load-test.js
```

## Optimization Recommendations

### Database Level

1. **Add missing indexes**:
   ```sql
   CREATE INDEX idx_employee_tenant_status ON employee(tenant_id, status);
   CREATE INDEX idx_attendance_date ON attendance_record(date);
   CREATE INDEX idx_leave_dates ON leave_request(start_date, end_date);
   ```

2. **Optimize queries**:
   - Use EXPLAIN ANALYZE to find slow queries
   - Eliminate full table scans
   - Use efficient joins

3. **Connection pooling**:
   - Adjust pool size based on load
   - Use pgBouncer for centralized pooling

### Application Level

1. **Add caching**:
   ```typescript
   // Cache dashboard stats (refresh every 5 minutes)
   @Get('stats')
   @CacheKey('dashboard-stats')
   @CacheTTL(300)
   async stats() { ... }
   ```

2. **Batch operations**:
   - Combine multiple queries with Promise.all()
   - Use DataLoader for deduplication

3. **Pagination optimization**:
   - Use cursor-based pagination (already implemented)
   - Limit max page size to prevent resource exhaustion

4. **Rate limiting**:
   - Implement per-user rate limits
   - Protect expensive operations

### Infrastructure Level

1. **Database replication**:
   - Use read replicas for heavy queries
   - Route analytics to read-only replica

2. **Caching layer**:
   - Add Redis for frequently accessed data
   - Cache dashboard aggregates

3. **Load balancing**:
   - Distribute traffic across multiple API instances
   - Use sticky sessions if needed

## Continuous Performance Monitoring

### CI/CD Integration

Add load testing to deployment pipeline:

```bash
# .github/workflows/performance.yml
- name: Run load tests
  run: |
    ./scripts/seed-load-test.sh --employees 2000
    ./scripts/run-load-test.sh --api-url ... --token ...
  if: github.ref == 'refs/heads/master'
```

### Performance Regression Detection

Compare new results against baseline:

```bash
# Extract metrics from both runs
BASELINE_P95=$(jq '.metrics.http_req_duration["p(95)"]' baseline.json)
CURRENT_P95=$(jq '.metrics.http_req_duration["p(95)"]' current.json)

# Alert if > 10% degradation
THRESHOLD=$(echo "$BASELINE_P95 * 1.1" | bc)
if (( $(echo "$CURRENT_P95 > $THRESHOLD" | bc -l) )); then
  echo "ALERT: Performance degraded"
  exit 1
fi
```

### Regular Testing Schedule

- **After each deployment**: Smoke test (light load)
- **Weekly**: Full load test (2,000 employees)
- **Monthly**: Stress test (5,000 employees)
- **Quarterly**: Soak test (24-hour sustained load)

## Tools and Resources

- **k6**: Load testing framework (https://k6.io/)
- **PostgreSQL EXPLAIN**: Query analysis
- **pg_stat_statements**: Query performance tracking
- **pgBouncer**: Connection pooling
- **Grafana**: Metrics visualization
- **Prometheus**: Metrics collection

## Related Documentation

- [Performance Baselines](./PERFORMANCE_BASELINES.md)
- [API Documentation](../api/README.md)
- [Database Schema](../api/prisma/schema.prisma)
- [Deployment Guide](./DEPLOYMENT_CHECKLIST.md)

---

**Last Updated**: September 2026
**Version**: 1.0
**Load Test Ready**: Yes (2,000+ employees)
