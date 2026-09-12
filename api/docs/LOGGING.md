# Structured JSON Logging with Pino

## Overview

Phase 5 implements structured JSON logging using Pino logger for the HRMS API. This provides:

- **Structured JSON output** for easy parsing and aggregation
- **Request context correlation** using unique request IDs
- **Automatic tenant and user context** capture from JWT tokens
- **Environment-aware configuration** (JSON production, pretty-printed development)
- **Log shipping ready** for external log drains (ELK, Better Stack, Datadog)

## Architecture

### Components

1. **PinoLoggerService** (`api/src/common/pino-logger.service.ts`)
   - Extends NestJS LoggerService interface
   - Uses Pino for structured JSON logging
   - Automatically merges request context from AsyncLocalStorage
   - Log levels: debug, info, warn, error

2. **Request Context Storage** (`api/src/common/request-context.ts`)
   - Uses Node.js AsyncLocalStorage for request-scoped context
   - Stores: requestId, tenantId, userId, userRole
   - Accessible throughout request lifecycle without parameter passing

3. **Request Context Middleware** (`api/src/common/request-context.middleware.ts`)
   - Generates UUID for each request
   - Extracts tenant/user info from JWT token
   - Stores context in AsyncLocalStorage
   - Adds X-Request-ID response header

4. **HTTP Request Logging** (`api/src/common/pino-http.middleware.ts`)
   - Logs HTTP requests and responses
   - Records timing information (duration_ms)
   - Skips verbose endpoints (health checks)

## Log Format

### Production Format (JSON to stdout)

```json
{
  "timestamp": "2026-09-11T10:30:45.123Z",
  "level": "info",
  "message": "Employee created",
  "service": "EmployeesService",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "userRole": "ADMIN",
  "duration_ms": 45,
  "employeeId": "emp-789"
}
```

### Development Format (Pretty-printed)

```
[10:30:45.123] INFO: Employee created
  requestId: 550e8400-e29b-41d4-a716-446655440000
  tenantId: tenant-123
  userId: user-456
  userRole: ADMIN
  service: EmployeesService
  duration_ms: 45
  employeeId: emp-789
```

## Configuration

### Environment Variables

- `LOG_LEVEL` - Minimum log level (debug, info, warn, error). Default: info (production), debug (development)
- `NODE_ENV` - Environment mode (production, development, test)

### Log Levels

- **debug** - Detailed information for debugging (request received/completed)
- **info** - General informational messages (business operations)
- **warn** - Warning messages (recoverable errors, deprecated usage)
- **error** - Error messages (unrecoverable errors, exceptions)

## Usage

### In Controllers

```typescript
import { PinoLoggerService } from '../common/pino-logger.service.js';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('EmployeesController');
  }

  @Post()
  async create(@Body() dto: CreateEmployeeDto) {
    const employee = await this.employeesService.create(dto);
    
    this.logger.info('Employee created', {
      employeeId: employee.id,
      tenantId: employee.tenantId,
    });
    
    return employee;
  }
}
```

### In Services

```typescript
import { PinoLoggerService } from '../common/pino-logger.service.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('EmployeesService');
  }

  async create(dto: CreateEmployeeDto) {
    const startTime = Date.now();
    
    try {
      const employee = await this.prisma.employee.create({
        data: dto,
      });
      
      this.logger.info('Employee persisted', {
        employeeId: employee.id,
        duration_ms: Date.now() - startTime,
      });
      
      return employee;
    } catch (error) {
      this.logger.error('Failed to create employee', error as string, {
        duration_ms: Date.now() - startTime,
      });
      throw error;
    }
  }
}
```

## Request Context Fields

All logs automatically include these fields when available:

| Field | Source | Description |
|-------|--------|-------------|
| `requestId` | Generated per request | UUID for distributed tracing |
| `tenantId` | JWT token (tenantId claim) | Tenant identifier |
| `userId` | JWT token (sub claim) | Authenticated user ID |
| `userRole` | JWT token (role claim) | User's role (ADMIN, MANAGER, EMPLOYEE) |
| `timestamp` | Generated at log time | ISO 8601 timestamp |
| `level` | Log method | debug, info, warn, error |
| `message` | Provided by caller | Log message |
| `service` | Logger context | Service/Controller name |

## Querying Logs

### Using grep (development/staging)

```bash
# Find all errors for a tenant
grep -r '"tenantId":"tenant-123".*"level":"error"' logs/

# Find all requests with specific requestId
grep '"requestId":"550e8400-e29b-41d4-a716-446655440000"' logs/

# Find slow requests (> 1000ms)
grep -E '"duration_ms":[1-9][0-9]{3,}' logs/
```

### Using ELK Stack

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "tenantId": "tenant-123" } },
        { "match": { "level": "error" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

### Using Better Stack (Log Management)

1. Set up Syslog endpoint from Better Stack
2. Configure log shipping to Better Stack via stdout
3. Use Better Stack UI to filter by:
   - tenantId
   - userId
   - requestId
   - level
   - message

## Performance Considerations

### Log Sampling for High-Traffic Endpoints

For endpoints that generate many logs, implement sampling:

```typescript
// Log only 10% of requests
if (Math.random() > 0.9) {
  this.logger.info('High-volume operation', { /* context */ });
}
```

### Async Log Shipping

The PinoLoggerService uses async transport to prevent blocking:

```typescript
// Pino writes logs asynchronously in production
// Non-blocking: application code continues immediately
this.logger.info('Operation completed');
```

### Log Disk Usage

Production logs go to stdout and should be captured by container log drivers.
Configure log rotation and retention at the container/kubernetes level.

## Integration with Log Drains

### Datadog

```yaml
# In deployment, configure log drain:
log_driver: "awslogs"
log_options:
  awslogs-group: "/ecs/hrms-api"
  awslogs-region: "us-east-1"
  awslogs-stream-prefix: "ecs"
```

Then configure Datadog log integration to scrape CloudWatch logs.

### ELK Stack

```yaml
# Filebeat configuration
filebeat.inputs:
- type: container
  enabled: true
  paths:
    - '/var/lib/docker/containers/*/*.log'

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### Better Stack

1. Create HTTP drain in Better Stack dashboard
2. Log shipper sends POST to drain endpoint with JSON payload
3. Better Stack indexes and makes searchable

## Monitoring Log Health

### Key Metrics

- **Request volume**: Count logs with `message: "Request received"`
- **Error rate**: Percentage of logs with `level: error`
- **P95 latency**: 95th percentile of `duration_ms`
- **Tenant isolation**: Verify all logs include correct `tenantId`

### Alerts

Set up alerts for:
- Error rate > 1% for 5 minutes
- Slow requests > 5s (P95 latency)
- Requests from unknown requestId (potential issue with ID generation)

## Best Practices

1. **Always include tenant context**
   - Use tenantId from request context automatically
   - Don't log cross-tenant data

2. **Log at appropriate level**
   - Use debug for development details
   - Use info for business operations
   - Use warn for recoverable issues
   - Use error for failures

3. **Include structured context**
   - Add meaningful fields: userId, employeeId, etc.
   - Avoid logging PII (passwords, SSNs)
   - Include timing for performance insights

4. **Use request ID for tracing**
   - requestId follows request through entire system
   - Use for correlating logs from multiple services
   - Include in error messages for customer support

5. **Test log output**
   - Verify logs appear with correct fields
   - Check log format in production
   - Monitor log volume and disk usage

## Troubleshooting

### Missing requestId

If logs don't include requestId:
- Check RequestContextMiddleware is registered
- Verify AsyncLocalStorage is available in Node.js runtime
- Check middleware ordering (should be early)

### Missing tenant context

If tenantId is missing:
- Verify JWT token includes tenantId claim
- Check JWT strategy extracts tenantId
- Ensure RequestContextMiddleware can access user info

### Logs going to stderr

In production, logs should go to stdout (captured by container drivers).
If using console.error() directly, route to stdout for consistency.

### High log volume

- Implement sampling for debug logs
- Filter out health checks (already done)
- Consider log retention policies
- Monitor disk usage of log storage

## Migration from LoggerService

Existing services using LoggerService can migrate to PinoLoggerService:

```typescript
// Old approach
import { LoggerService } from './logger.service.js';
constructor(private logger: LoggerService) {}

// New approach
import { PinoLoggerService } from './pino-logger.service.js';
constructor(private logger: PinoLoggerService) {}
```

Both are compatible with the interface. New code should use PinoLoggerService.

## References

- [Pino Documentation](https://getpino.io/)
- [pino-pretty Plugin](https://github.com/pinojs/pino-pretty)
- [Structured Logging Best Practices](https://www.splunk.com/en_us/blog/learn/structured-logging.html)
