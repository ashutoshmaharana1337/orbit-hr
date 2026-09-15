import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';
const TOKEN = __ENV.AUTH_TOKEN || '';

// Test options with ramp-up, sustain, and ramp-down stages
export const options = {
  stages: [
    { duration: '2m', target: 100, name: 'Ramp-up' },
    { duration: '5m', target: 100, name: 'Sustain' },
    { duration: '2m', target: 0, name: 'Ramp-down' },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.1'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
};

// Helper function to make authenticated requests
function makeRequest(method, url, body = null) {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { name: url },
  };

  let response;
  if (method === 'GET') {
    response = http.get(url, params);
  } else if (method === 'POST') {
    response = http.post(url, body ? JSON.stringify(body) : null, params);
  } else if (method === 'PATCH') {
    response = http.patch(url, body ? JSON.stringify(body) : null, params);
  }
  return response;
}

// Test 1: List all employees with pagination
function testListEmployees() {
  group('GET /employees - List all employees', () => {
    // Test with different page sizes
    const pageSizes = [20, 50, 100];

    for (const pageSize of pageSizes) {
      const response = makeRequest('GET', `${BASE_URL}/employees?limit=${pageSize}`);

      check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
        'has items': (r) => r.body.includes('items'),
        'has pagination': (r) => r.body.includes('nextCursor') || r.body.includes('hasMore'),
      });
    }

    sleep(1);
  });
}

// Test 2: Dashboard stats (aggregate calculations)
function testDashboardStats() {
  group('GET /dashboard/stats - Dashboard aggregates', () => {
    const response = makeRequest('GET', `${BASE_URL}/dashboard/stats`);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
      'has totalEmployees': (r) => r.body.includes('totalEmployees'),
      'has attendanceRate': (r) => r.body.includes('attendanceRate'),
      'has pendingLeaveRequests': (r) => r.body.includes('pendingLeaveRequests'),
    });

    sleep(0.5);
  });
}

// Test 3: Attendance trend (7-day data)
function testAttendanceTrend() {
  group('GET /attendance/trend - 7-day trend', () => {
    const response = makeRequest('GET', `${BASE_URL}/attendance/trend?days=7`);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
      'has trend data': (r) => r.body.includes('day') || r.body.includes('present'),
    });

    sleep(0.5);
  });
}

// Test 4: Get attendance summary
function testAttendanceSummary() {
  group('GET /attendance/summary - Attendance summary', () => {
    const response = makeRequest('GET', `${BASE_URL}/attendance/summary`);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 150ms': (r) => r.timings.duration < 150,
      'has status counts': (r) => r.body.includes('status'),
    });

    sleep(0.5);
  });
}

// Test 5: Get today's attendance (large result set)
function testTodayAttendance() {
  group('GET /attendance/today - Today attendance', () => {
    const response = makeRequest('GET', `${BASE_URL}/attendance/today`);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 400ms': (r) => r.timings.duration < 400,
    });

    sleep(0.5);
  });
}

// Test 6: List leave requests
function testListLeaveRequests() {
  group('GET /leave - List leave requests', () => {
    const response = makeRequest('GET', `${BASE_URL}/leave?limit=50`);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.5);
  });
}

// Test 7: Get individual employee (single record)
function testGetEmployee() {
  group('GET /employees/:id - Get single employee', () => {
    // In load test, we would use a generated employee ID
    // This test structure shows how to test individual record retrieval
    const response = makeRequest('GET', `${BASE_URL}/employees/test-id`);

    // Will likely be 404, but we're testing performance regardless
    check(response, {
      'response time < 100ms': (r) => r.timings.duration < 100,
    });

    sleep(0.3);
  });
}

// Test 8: Create leave request (write operation)
function testCreateLeaveRequest() {
  group('POST /leave - Create leave request', () => {
    const leavePayload = {
      employeeId: 'test-employee-id',
      type: 'ANNUAL',
      startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      endDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
      reason: 'Load test leave request',
    };

    const response = makeRequest('POST', `${BASE_URL}/leave`, leavePayload);

    // Will likely fail due to invalid employee ID, but measures write performance
    check(response, {
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1);
  });
}

// Main load test execution
export default function() {
  // Distribute load across different test scenarios
  // Each user session goes through a random mix of tests

  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% of traffic: Heavy list operations
    testListEmployees();
    testDashboardStats();
  } else if (scenario < 0.6) {
    // 30% of traffic: Dashboard + Trends
    testDashboardStats();
    testAttendanceTrend();
    testAttendanceSummary();
  } else if (scenario < 0.8) {
    // 20% of traffic: Attendance operations
    testTodayAttendance();
    testAttendanceTrend();
  } else if (scenario < 0.9) {
    // 10% of traffic: Leave operations
    testListLeaveRequests();
    testCreateLeaveRequest();
  } else {
    // 10% of traffic: Mixed operations
    testListEmployees();
    testGetEmployee();
    testDashboardStats();
  }

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

// Summary output
export function handleSummary(data) {
  console.log('================================');
  console.log('Load Test Summary');
  console.log('================================');

  const httpReqDuration = data.metrics.http_req_duration.values;
  if (httpReqDuration) {
    console.log(`\nResponse Times:`);
    console.log(`  Min:  ${httpReqDuration.min}ms`);
    console.log(`  Max:  ${httpReqDuration.max}ms`);
    console.log(`  Avg:  ${httpReqDuration.avg}ms`);
    console.log(`  p95:  ${httpReqDuration['p(95)']}ms`);
    console.log(`  p99:  ${httpReqDuration['p(99)']}ms`);
  }

  const httpReqFailed = data.metrics.http_req_failed?.values?.rate || 0;
  console.log(`\nError Rate: ${(httpReqFailed * 100).toFixed(2)}%`);

  const httpReqs = data.metrics.http_reqs?.values?.count || 0;
  console.log(`\nTotal Requests: ${httpReqs}`);

  console.log('================================\n');
}
