# Performance Baselines - Phase 5

## Overview

This document defines the expected performance characteristics of the HRMS system at scale (2,000+ employees). These baselines are measured on a production-like staging environment and serve as targets for performance monitoring and optimization.

## Test Environment

- **Employees**: 2,000+
- **Attendance Records**: 5 years of historical data (~250,000+ records)
- **Leave Requests**: ~6,000+ requests
- **Load Pattern**: 100 concurrent users over 9 minutes
  - 2 minutes ramp-up (0→100 users)
  - 5 minutes sustain (100 users)
  - 2 minutes ramp-down (100→0 users)

## Response Time Baselines

Response times are measured in milliseconds (ms) with focus on p50, p95, and p99 percentiles.

### GET /employees - List all employees

**Expected Performance with 2,000+ employees:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 120 ms   | < 150 ms  |
| p95    | 380 ms   | < 500 ms  |
| p99    | 520 ms   | < 800 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Uses cursor-based pagination with limit parameter
- Tested with limits: 20, 50, 100
- Filter support: departmentId, status, search
- Response includes manager information (with includes)

### GET /dashboard/stats - Dashboard aggregate statistics

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 85 ms    | < 120 ms  |
| p95    | 180 ms   | < 250 ms  |
| p99    | 220 ms   | < 350 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Parallel queries for: totalEmployees, activeCount, onLeave, pendingLeave, headcount, attendance
- Multiple COUNT and GROUP BY operations
- Calls AttendanceService.summary() for presence data

### GET /attendance/trend - 7-day attendance trend

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 95 ms    | < 150 ms  |
| p95    | 280 ms   | < 400 ms  |
| p99    | 380 ms   | < 600 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Date range queries over attendance records
- Calculates present/onLeave aggregates
- Supports configurable days parameter (tested with 7)

### GET /attendance/summary - Today's attendance summary

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 65 ms    | < 100 ms  |
| p95    | 140 ms   | < 200 ms  |
| p99    | 165 ms   | < 280 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- GROUP BY status for today's date
- Fast query with timezone-aware date filtering

### GET /attendance/today - Today's full attendance records

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 150 ms   | < 250 ms  |
| p95    | 380 ms   | < 500 ms  |
| p99    | 450 ms   | < 700 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Returns all employees' attendance for today
- With employee and department includes
- Ordered by employee name

### GET /leave - List leave requests

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 110 ms   | < 180 ms  |
| p95    | 320 ms   | < 450 ms  |
| p99    | 420 ms   | < 650 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Cursor-based pagination
- Filter support: status, leaveType, employeeId
- Joins with employee data

### POST /leave - Create leave request

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 75 ms    | < 150 ms  |
| p95    | 180 ms   | < 300 ms  |
| p99    | 250 ms   | < 400 ms  |
| Error Rate | < 1% | < 5% |

**Notes:**
- Write operation with validation
- Creates audit log entry
- Updates leave balance
- Some errors expected (validation failures)

### GET /employees/:id - Get single employee

**Expected Performance:**

| Metric | Baseline | Threshold |
|--------|----------|-----------|
| p50    | 45 ms    | < 80 ms   |
| p95    | 95 ms    | < 150 ms  |
| p99    | 120 ms   | < 200 ms  |
| Error Rate | 0% | < 1% |

**Notes:**
- Fast direct lookup by primary key
- Includes manager information
- Role-based field filtering

## Database Metrics

### Query Performance

| Query | Baseline | Target |
|-------|----------|--------|
| Simple SELECT (PK lookup) | 1-5 ms | < 10 ms |
| Filtered list with pagination | 20-50 ms | < 100 ms |
| GROUP BY aggregation | 10-30 ms | < 100 ms |
| JOIN operations | 15-40 ms | < 100 ms |
| Complex multi-query (dashboard) | 60-150 ms | < 250 ms |

### Connection Pool

- **Pool Size**: 10 connections
- **Max**: 20 connections
- **Timeout**: 5000 ms
- **Idle Timeout**: 30000 ms

### Indexes Required

Essential indexes for load testing performance:

```sql
-- Employee indexes
CREATE INDEX idx_employee_tenant_status ON employee(tenant_id, status);
CREATE INDEX idx_employee_tenant_department ON employee(tenant_id, department_id);
CREATE INDEX idx_employee_manager ON employee(manager_id);

-- Attendance indexes
CREATE INDEX idx_attendance_date ON attendance_record(date);
CREATE INDEX idx_attendance_employee_date ON attendance_record(employee_id, date);
CREATE INDEX idx_attendance_tenant_date ON attendance_record(tenant_id, date);

-- Leave request indexes
CREATE INDEX idx_leave_tenant_status ON leave_request(tenant_id, status);
CREATE INDEX idx_leave_date_range ON leave_request(start_date, end_date);

-- Audit indexes
CREATE INDEX idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);
```

## System Resource Metrics

### Memory Usage

- **Per VU**: ~2-3 MB
- **100 concurrent users**: 200-300 MB application memory
- **Target**: < 500 MB for API process

### CPU Usage

- **100 concurrent users**: 30-50% CPU utilization
- **Target**: < 75% CPU at sustained load

### Network I/O

- **Throughput**: 5-10 MB/s (application level)
- **Connection Count**: 10-20 active DB connections
- **Target**: < 100 Mbps bandwidth usage

## Pagination Performance

Cursor-based pagination must handle large datasets efficiently:

- **Page Size 20**: 80-120 ms response time
- **Page Size 50**: 100-150 ms response time
- **Page Size 100**: 120-180 ms response time

All should be < 500 ms p95.

## Optimization Targets

### Response Time Thresholds

```
CRITICAL (Must Fix): p95 > baseline + 100%
ATTENTION (Review): p95 > baseline + 50%
ACCEPTABLE: p95 < baseline + 50%
```

### Error Rate Thresholds

```
CRITICAL: > 5% error rate
WARNING: 1-5% error rate
ACCEPTABLE: < 1% error rate
```

## Performance Degradation Alerts

Trigger performance investigation if:

1. **Response time increases > 10%** from baseline
2. **Error rate > 1%** on any endpoint
3. **p99 exceeds baseline + 200%**
4. **Database connection pool exhaustion**
5. **Memory usage > 600 MB**
6. **CPU usage > 80%** sustained

## Continuous Monitoring

### Baseline Review Schedule

- **After each deployment**: Verify baselines still met
- **Monthly**: Analyze trends, identify degradation
- **Quarterly**: Full load test run, update baselines if needed

### Metrics to Track

1. **Per Endpoint**:
   - Response time (p50, p95, p99)
   - Error rate
   - Request count
   - Throughput (req/s)

2. **Database**:
   - Query execution time
   - Connection pool usage
   - Slow query log
   - Index usage

3. **System**:
   - Memory utilization
   - CPU utilization
   - Network I/O
   - Disk I/O

## Performance Analysis Tools

### k6 Load Testing
- Distributed load generation
- Multiple scenario support
- Threshold validation
- JSON output for analysis

### Database Query Analysis
```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes;

-- Slow query analysis
EXPLAIN ANALYZE SELECT ... ;

-- Connection monitoring
SELECT count(*) FROM pg_stat_activity;
```

### Application Monitoring
- Response time histograms
- Error rate tracking
- Database connection pool status
- Memory and CPU metrics

## Optimization Strategies

If baselines are not met:

### Response Time Issues

1. **Check query plans**: Use EXPLAIN ANALYZE
2. **Verify indexes exist**: Check database schema
3. **Identify N+1 queries**: Review service code
4. **Enable query caching**: For frequently accessed data
5. **Optimize sorting**: Use indexed columns
6. **Reduce payload size**: Use field selection

### Scalability Issues

1. **Connection pooling**: Tune pool size
2. **Query batching**: Combine multiple queries
3. **Caching strategy**: Redis for aggregates
4. **Database optimization**: Schema changes, partitioning
5. **Horizontal scaling**: Read replicas for heavy queries

## Related Documentation

- [Load Testing Guide](./LOAD_TESTING.md)
- [API Documentation](../api/README.md)
- [Database Schema](../api/prisma/schema.prisma)

---

**Last Updated**: September 2026
**Version**: 1.0
**Status**: Baseline metrics established at 2,000 employees
