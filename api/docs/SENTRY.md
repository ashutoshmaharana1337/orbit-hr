# Sentry Error Tracking & Monitoring

This document describes the Sentry error tracking implementation for the HRMS application (Phase 5).

## Overview

Sentry is integrated into both the API (NestJS) and Web (Next.js) applications to provide:

- **Real-time error tracking** - Automatic capture of unhandled exceptions
- **Tenant context** - Track which tenant experienced the error (multi-tenant debugging)
- **User context** - Know who triggered the error and their role
- **Request correlation** - Link errors to specific requests via request IDs
- **Performance monitoring** - Track slow operations and bottlenecks
- **Release tracking** - Monitor errors across application versions

## Setup & Configuration

### Getting Started with Sentry

1. **Create a Sentry Account**
   - Go to https://sentry.io/
   - Sign up or log in
   - Create a new organization

2. **Create Projects**
   - Create one project for the **API** (NestJS)
   - Create one project for the **Web** (Next.js)
   - Note the DSN for each project (format: `https://key@organization.ingest.sentry.io/projectid`)

3. **Configure Environment Variables**

   **For API (`api/.env` or platform secrets):**
   ```
   SENTRY_DSN=https://key@organization.ingest.sentry.io/api-project-id
   SENTRY_RELEASE=1.0.0  # Optional: version tracking
   NODE_ENV=production   # Or staging, development
   ```

   **For Web (`web/.env.local` or build environment):**
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://key@organization.ingest.sentry.io/web-project-id
   NODE_ENV=production
   ```

### Architecture

#### Backend (API)

The API uses `@sentry/nestjs` for Node.js server-side error tracking.

**Files:**
- `api/src/common/sentry.service.ts` - Main Sentry service with helper methods
- `api/src/common/sentry-context.interceptor.ts` - Interceptor that enriches errors with context
- `api/src/main.ts` - Sentry initialization at app startup

**Initialization Flow:**
```
app startup
    ↓
main.ts: Sentry.init() - initialize with DSN
    ↓
AppModule: Register SentryService and SentryContextInterceptor
    ↓
Every request:
  - SentryContextInterceptor extracts user context
  - Sets tenant ID, user ID, role as Sentry context
  - Starts transaction for performance tracking
  - On error: captures exception with full context
```

**Key Components:**

1. **SentryService** (`api/src/common/sentry.service.ts`)
   - Initialize Sentry with configuration
   - Set user/tenant/role context
   - Capture exceptions and messages
   - Create transactions for performance monitoring

2. **SentryContextInterceptor** (`api/src/common/sentry-context.interceptor.ts`)
   - Applied globally to all requests
   - Extracts user context from JWT token
   - Generates/tracks request IDs
   - Enriches errors with tenant and role information
   - Captures exceptions automatically

#### Frontend (Web)

The Web app uses `@sentry/nextjs` for client-side error tracking.

**Files:**
- `web/next.config.ts` - Sentry integration via `withSentryConfig`
- `web/sentry.server.config.ts` - Server-side configuration
- `web/sentry.client.config.ts` - Client-side configuration
- `web/src/app/error.tsx` - Error boundary with Sentry context
- `web/src/app/global-error.tsx` - Global error boundary for layout errors

**Initialization Flow:**
```
Next.js build
    ↓
next.config.ts: withSentryConfig() wraps the config
    ↓
Sentry files loaded:
  - sentry.server.config.ts (server-side errors)
  - sentry.client.config.ts (client-side errors)
    ↓
Every error:
  - error.tsx catches component errors
  - global-error.tsx catches layout errors
  - Sentry auto-captures unhandled JS errors
  - User context added from auth state
```

## Error Context

### What Gets Tracked

Every error reported to Sentry includes:

#### Backend (API)
```javascript
{
  // Automatic
  message: "Error message",
  stack: "Stack trace...",
  
  // From Sentry tags
  tenantId: "tenant-123",
  userRole: "ADMIN",
  requestId: "abc123-def456",
  statusCode: "500",
  endpoint: "POST /api/employees",
  
  // From Sentry user context
  user: {
    id: "user-456",
    email: "user@example.com"
  },
  
  // From Sentry custom context
  request: {
    method: "POST",
    path: "/api/employees",
    url: "/api/employees?page=1",
    ip: "192.168.1.1",
    requestId: "abc123-def456"
  },
  
  tenant: {
    id: "tenant-123"
  },
  
  user: {
    id: "user-456",
    email: "user@example.com",
    role: "ADMIN",
    tenantId: "tenant-123"
  },
  
  error: {
    statusCode: 500,
    message: "Employee not found",
    name: "NotFoundException"
  }
}
```

#### Frontend (Web)
```javascript
{
  // Automatic
  message: "JavaScript error message",
  stack: "Stack trace...",
  
  // From Auth Context
  user: {
    id: "user-456",
    email: "user@example.com",
    username: "John Doe"
  },
  
  // From Sentry tags
  tenantId: "tenant-123",
  userRole: "ADMIN",
  
  // From Sentry context
  tenant: {
    id: "tenant-123",
    name: "Acme Corp",
    slug: "acme-corp"
  }
}
```

### Setting Custom Context

**Backend (API):**
```typescript
import { SentryService } from './common/sentry.service';

@Injectable()
export class MyService {
  constructor(private sentry: SentryService) {}

  async doSomething(tenantId: string, userId: string) {
    // Set user context
    this.sentry.setUserContext(userId, 'user@example.com', 'John Doe');
    
    // Set tenant context
    this.sentry.setTenantContext(tenantId);
    
    // Set role context
    this.sentry.setRoleContext('ADMIN');
    
    // Add custom context
    this.sentry.setCustomContext('operation', {
      name: 'employee_import',
      batchSize: 1000,
    });
  }
}
```

**Frontend (Web):**
```typescript
import * as Sentry from '@sentry/nextjs';
import { useAuth } from '@/lib/auth-context';

export function MyComponent() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.employee?.name,
      });

      Sentry.setTag('tenantId', user.tenant.id);
      Sentry.setTag('userRole', user.role);
    }
  }, [user]);
}
```

## Viewing Errors in Sentry Dashboard

### Accessing the Dashboard

1. Log in to https://sentry.io/
2. Select your organization
3. Select the project (API or Web)

### Key Pages

1. **Issues** - List of error groups
   - Shows error message, frequency, last occurrence
   - Group by tenant, user role, or URL
   - Click to see details

2. **Error Detail** - Full error information
   - Exception message and stack trace
   - All tags (tenantId, userRole, requestId, etc.)
   - User information
   - Request context (URL, method, headers)
   - Breadcrumbs (user actions leading to error)
   - Related events

3. **Performance** - Transaction tracking
   - Shows slow requests
   - Transaction duration
   - Database queries
   - API calls

### Filtering by Context

**Filter by Tenant:**
```
tag:tenantId:"tenant-123"
```

**Filter by User Role:**
```
tag:userRole:"ADMIN"
```

**Filter by Request ID:**
```
tag:requestId:"abc123-def456"
```

**Filter by Endpoint:**
```
tag:endpoint:"POST /api/employees"
```

**Combined Filter:**
```
tag:tenantId:"tenant-123" tag:userRole:"ADMIN" is:unresolved
```

## Alert Configuration

### Setting Up Alerts

1. Go to **Alerts** in the Sentry navigation
2. Click **Create Alert Rule**
3. Configure conditions:

**Example Alert: Production Errors**
```
When: An issue is seen by more than 10 people
  (OR) An issue occurs more than 5 times
  (OR) An issue has a new unseen error

Then: Send notification to [Slack/Email/PagerDuty]
```

**Example Alert: High-Priority Tenant**
```
When: An error has tag environment:production
  AND tag tenantId:"important-tenant-123"

Then: Page on-call engineer (PagerDuty)
```

### Recommended Alert Rules

1. **Production Errors (All)**
   - Condition: `environment:production` AND `is:new`
   - Action: Email + Slack #alerts

2. **High-Severity Errors (500+)**
   - Condition: `status_code >= 500`
   - Action: PagerDuty page on-call

3. **Auth Errors**
   - Condition: `endpoint:"/api/auth/*"`
   - Action: Email security team

4. **Critical Tenant Issues**
   - Condition: `tenantId:"critical-tenant-id"`
   - Action: Phone call to team lead

## Release Tracking

Track errors across application versions:

### Backend Release

1. **Set Release During Deploy**
   ```bash
   # Docker build
   docker build --build-arg VERSION=1.0.0 -t hrms-api:1.0.0 .
   
   # Or set environment variable
   export SENTRY_RELEASE=1.0.0
   npm run build
   npm start
   ```

2. **View Errors by Release**
   - In Sentry: Filter by `release:"1.0.0"`
   - Compare errors across versions
   - Track if fixes actually reduced errors

### Frontend Release

1. **Configure Next.js Build**
   ```typescript
   // next.config.ts
   const config = {
     sentry: {
       release: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
     },
   };
   ```

2. **Deploy with Version**
   ```bash
   NEXT_PUBLIC_APP_VERSION=1.0.0 npm run build
   ```

## Sample Rate Configuration

Sentry charges per event. Use sampling to control costs while maintaining visibility:

### Backend (API)
- **Development**: 100% sample rate (all transactions tracked)
- **Staging**: 50% sample rate
- **Production**: 10% sample rate (balance cost vs visibility)

Configure in `api/src/main.ts`:
```typescript
Sentry.init({
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

### Frontend (Web)
- **Development**: 100% session, 100% error sample rate
- **Production**: 10% session, 100% error sample rate

Configure in `web/sentry.client.config.ts`:
```typescript
Sentry.init({
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
  replaysOnErrorSampleRate: 1.0,
});
```

### Cost Estimation

As of 2024, Sentry pricing (check current pricing):
- **Errors**: $0.50 per 1,000 events
- **Performance**: $2.00 per 1,000 events
- **Replays**: $2.00 per 1,000 events

With 10% sampling in production:
- 100 errors/day × 365 = 36,500/year
- 36,500 / 1,000 × $0.50 = ~$18/month

Increase sampling if budget allows for better visibility.

## Integration with Logging

Sentry complements structured logging:

- **Logs** (PinoLogger): Record all events, high volume
- **Sentry** (Error Tracking): Focus on errors, lower volume, better context

### When to Use Logs vs Sentry

**Use Logs For:**
- Normal operation events (request received, response sent)
- Business logic milestones
- Debug information
- High-frequency events

**Use Sentry For:**
- Unhandled exceptions
- HTTP errors (5xx)
- Business logic failures
- Performance issues

### Capturing Both

```typescript
// Log the event
this.logger.error('Employee import failed', {
  tenantId,
  batchId,
  errorMessage: error.message,
});

// Also capture in Sentry (more detailed context)
this.sentry.captureException(error);
this.sentry.setCustomContext('import', {
  tenantId,
  batchId,
  rowCount: rows.length,
});
```

## Troubleshooting

### Errors Not Appearing in Sentry

1. **Check DSN is Set**
   ```bash
   # API
   echo $SENTRY_DSN
   
   # Web
   echo $NEXT_PUBLIC_SENTRY_DSN
   ```

2. **Verify Environment**
   - Development: May have disabled Sentry (optional)
   - Check if `NODE_ENV=test` (test environment skips Sentry)

3. **Check Network**
   - Ensure app can reach `*.ingest.sentry.io`
   - Check firewall/proxy settings
   - Sentry may be blocked by ad-blockers (use tunnel route)

4. **Review Sentry Logs**
   ```bash
   # Docker
   docker logs hrms-api | grep -i sentry
   docker logs hrms-web | grep -i sentry
   ```

### High False Positives

1. **Exclude Expected Errors**
   ```typescript
   // In sentry.service.ts
   ignoreErrors: [
     'NetworkError',
     'QuotaExceededError',
   ],
   ```

2. **Filter Errors in Sentry Dashboard**
   - Create filter in Sentry settings
   - Skip notifications for known patterns

### Performance Impact

Sentry should have minimal impact:
- Errors are queued and sent asynchronously
- Network requests are non-blocking
- If Sentry is down, application continues normally

## Development vs Production

### Development

- Sentry optional (can skip by not setting DSN)
- High sampling rate for better debugging
- Detailed error information captured
- Source maps included

### Production

- Sentry strongly recommended
- Lower sampling rate (10%) to control costs
- Essential for monitoring production issues
- Source maps uploaded for debugging
- Alert rules configured for quick response

## Security Considerations

### What NOT to Send to Sentry

Never include in error messages or context:
- Passwords
- API keys / tokens
- Credit card numbers
- Personal identification numbers
- Database credentials
- Customer data (PII)

### Best Practices

1. **Redact Sensitive Data**
   ```typescript
   // Before sending to Sentry
   const sanitized = error.message
     .replace(/password=\S+/gi, 'password=***')
     .replace(/token=\S+/gi, 'token=***');
   ```

2. **Use allowList for Tenant Data**
   ```typescript
   // Only include tenant ID, not full data
   sentry.setTenantContext(tenantId); // Good
   // Don't include tenant details like billing info
   ```

3. **Review Source Maps**
   - Uploaded source maps expose code
   - Sentry: Settings → Release Artifacts
   - Review what's being uploaded

## References

- **Sentry Docs**: https://docs.sentry.io/
- **NestJS Integration**: https://docs.sentry.io/platforms/javascript/guides/nestjs/
- **Next.js Integration**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Sentry Best Practices**: https://docs.sentry.io/product/best-practices/

## Maintenance

### Regular Tasks

1. **Weekly** (5 min)
   - Review Sentry alerts
   - Acknowledge/resolve fixed issues

2. **Monthly** (30 min)
   - Review alert rules effectiveness
   - Check sampling rates vs costs
   - Update release versions

3. **Quarterly** (1 hour)
   - Review top errors trending
   - Update ignore rules
   - Security audit of captured data

### Version Notes

- **Phase 5**: Initial Sentry integration with tenant/role context
- **Dependencies**: `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/react`, `@sentry/tracing`
- **Compatibility**: NestJS 12.x, Next.js 16.x, React 19.x

---

**Implementation Date**: September 11, 2026  
**Status**: Active in Phase 5  
**Last Updated**: 2026-09-11
