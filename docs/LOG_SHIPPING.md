# Log Shipping and Aggregation - Phase 5

## Overview

This document describes the log shipping and aggregation infrastructure for the HRMS application. All logs are output as JSON to stdout, making them compatible with various log aggregation services and platforms.

## Status: IMPLEMENTED ✅

## Features

- **Structured JSON Logging**: All logs are JSON formatted to stdout
- **Request Context Tracking**: Each request has a unique ID for tracing
- **Tenant Isolation**: Tenant ID included in all logs
- **User Attribution**: User ID and role tracked in logs
- **Multiple Aggregation Options**: Support for Railway, Fly.io, Render, Better Stack, ELK Stack
- **Fallback Storage**: Local file fallback when remote service is unavailable
- **Batching**: Logs are batched to reduce API calls
- **Non-blocking**: Log shipping doesn't slow down request processing

## Log Format

All logs follow this JSON schema:

```json
{
  "message": "User login",
  "level": "info",
  "timestamp": "2026-09-11T10:30:45.123Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "userRole": "EMPLOYEE",
  "duration": 145,
  "statusCode": 200,
  "endpoint": "/api/employees",
  "stack": "Error stack trace (for error level only)"
}
```

### Log Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `message` | string | Human-readable log message | "User login" |
| `level` | string | Log level: debug, info, warn, error | "info" |
| `timestamp` | ISO 8601 | When the log was created | "2026-09-11T10:30:45.123Z" |
| `requestId` | UUID | Unique identifier for the request | "550e8400-e29b-41d4-a716-446655440000" |
| `tenantId` | string | Tenant ID for multi-tenant apps | "tenant-123" |
| `userId` | string | User ID making the request | "user-456" |
| `userRole` | enum | User's role in the system | "EMPLOYEE" |
| `duration` | number | Request duration in milliseconds | 145 |
| `statusCode` | number | HTTP response status code | 200 |
| `endpoint` | string | API endpoint path | "/api/employees" |
| `stack` | string | Full stack trace (error level only) | "Error: ..." |

## Platform-Specific Log Drain Setup

### Railway

Railway automatically captures stdout logs from your container. No additional configuration needed!

**How it works:**
1. Deploy your app to Railway
2. All JSON output to stdout is automatically captured
3. Logs are available in Railway dashboard under "Logs" tab
4. No environment variables needed

**Access logs:**
1. Go to Railway dashboard
2. Select your HRMS API service
3. Click "Logs" tab
4. View and search logs

**Query examples:**
```
Filter by request ID: requestId:"550e8400-e29b-41d4-a716-446655440000"
Filter by tenant: tenantId:"tenant-123"
Filter by error level: level:"error"
Filter by user: userId:"user-456"
Filter by role: userRole:"EMPLOYEE"
```

### Fly.io

Fly.io provides built-in log storage but we recommend forwarding to Better Stack for better querying and long-term retention.

**Setup log shipping to Better Stack:**

1. Get your Better Stack source token (see Better Stack Integration below)

2. Set environment variable on Fly.io:
```bash
flyctl secrets set LOG_SHIPPER_ENABLED=true
flyctl secrets set LOG_SHIPPER_SOURCE_TOKEN=your_source_token_here
```

3. Or update `fly.toml`:
```toml
[env]
  LOG_SHIPPER_ENABLED = "true"
  LOG_SHIPPER_SOURCE_TOKEN = "your_source_token_here"
```

4. Deploy: `flyctl deploy`

5. Check logs: `flyctl logs`

**Access logs in Better Stack:**
See Better Stack Integration section below.

### Render

Render stores logs for a limited time. For production, set up Better Stack integration.

**Setup log shipping to Better Stack:**

1. Get your Better Stack source token (see Better Stack Integration below)

2. Set environment variables in Render dashboard:
   - Go to your service → Environment
   - Add `LOG_SHIPPER_ENABLED` = `true`
   - Add `LOG_SHIPPER_SOURCE_TOKEN` = `your_source_token`

3. Deploy

4. View logs in Render dashboard or Better Stack

**Query logs:**
Use Better Stack's query interface (see Better Stack Integration below).

### Self-Hosted Docker

For self-hosted deployments, configure your Docker log driver.

#### Option 1: JSON File Log Driver (Recommended for simplicity)

This is the default in the provided Dockerfile.

```bash
docker run \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  your-hrms-api:latest
```

**Log files location:**
- Linux: `/var/lib/docker/containers/[container_id]/[container_id]-json.log`
- Can be read with: `docker logs your-container-name`

**Example:**
```bash
# View logs
docker logs hrms-api

# Stream logs
docker logs -f hrms-api

# View last 100 lines
docker logs --tail 100 hrms-api
```

#### Option 2: Better Stack Integration (Recommended for production)

See Better Stack Integration section below.

#### Option 3: Syslog Log Driver

For integration with system logging:

```bash
docker run \
  --log-driver syslog \
  --log-opt syslog-address=udp://127.0.0.1:514 \
  your-hrms-api:latest
```

**With docker-compose.yml:**
```yaml
services:
  api:
    image: hrms-api:latest
    logging:
      driver: syslog
      options:
        syslog-address: "udp://127.0.0.1:514"
        tag: "hrms-api"
```

#### Option 4: Custom Logging with Logrotate

For local file-based logging with rotation:

1. Configure log file path in environment:
```bash
LOG_FALLBACK_PATH="/var/log/hrms/logs.jsonl"
```

2. Set up logrotate in `/etc/logrotate.d/hrms`:
```
/var/log/hrms/logs.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0600 nobody nobody
}
```

3. View logs:
```bash
tail -f /var/log/hrms/logs.jsonl | jq .
```

## Better Stack Integration

Better Stack is a log aggregation service ideal for production deployments.

### Setup

1. **Create account at** https://betterstack.com/

2. **Get your source token:**
   - Log in to Better Stack
   - Go to Sources
   - Create a new Source → JSON format
   - Copy the source token

3. **Set environment variables:**

   For production environments:
   ```bash
   LOG_SHIPPER_ENABLED=true
   LOG_SHIPPER_SOURCE_TOKEN=your_source_token_here
   LOG_SHIPPER_ENDPOINT=https://in.betterstack.com/api/v1/logs
   LOG_FALLBACK_PATH=/tmp/logs-fallback.jsonl
   ```

4. **Deploy and verify:**
   ```bash
   # Check logs are flowing
   curl https://uptime.betterstack.com/api/v1/sources/your-source-id/logs
   ```

### Features

- **Log Retention**: 7 days free, 30+ days paid
- **Live Tail**: Watch logs in real-time
- **Advanced Filtering**: Search by any JSON field
- **Alerting**: Create alerts on error patterns
- **Integrations**: Slack, PagerDuty, Webhook, etc.

### Query Interface

Better Stack provides a powerful query syntax:

**Basic queries:**
```
level:error                              # All errors
requestId:"550e8400-e29b-41d4-a716-446655440000"  # Single request
tenantId:"tenant-123"                   # All logs for a tenant
userId:"user-456"                       # All actions by a user
```

**Complex queries:**
```
level:error AND tenantId:"tenant-123"   # Errors for specific tenant
statusCode:500 AND level:error          # Server errors
duration:[1000 TO *]                    # Slow requests (> 1 second)
message:"User login" AND level:info     # Successful logins
```

**Time ranges:**
```
timestamp:[2026-09-10T00:00:00Z TO 2026-09-11T23:59:59Z] AND level:error
```

### Cost Estimation

**Better Stack pricing** (as of 2026):
- Free tier: 50 GB logs/month
- $5-50/month: Based on log volume
- Typical HRMS log volume: 100-500 MB/day = 3-15 GB/month

For a typical enterprise deployment with multiple tenants:
- Expected cost: $5-20/month

## ELK Stack Integration (Self-Hosted)

For self-hosted deployments, you can use the ELK Stack (Elasticsearch, Logstash, Kibana).

### Architecture

```
Application (JSON stdout)
    ↓
Docker Log Driver (json-file or syslog)
    ↓
Logstash (Parsing & Processing)
    ↓
Elasticsearch (Storage & Indexing)
    ↓
Kibana (Visualization & Querying)
```

### Setup

#### 1. Docker Compose ELK Stack

Create `docker-compose.elk.yml`:

```yaml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    ports:
      - "5000:5000"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

  api:
    build: ./api
    environment:
      - DATABASE_URL=postgresql://...
      - LOG_FALLBACK_PATH=/var/log/hrms/logs.jsonl
    logging:
      driver: syslog
      options:
        syslog-address: "udp://localhost:5000"
        syslog-format: rfc3339
    depends_on:
      - logstash

volumes:
  elasticsearch_data:
```

#### 2. Logstash Configuration

Create `logstash.conf`:

```
input {
  syslog {
    port => 5000
    codec => json
  }
}

filter {
  # Parse the JSON payload
  json {
    source => "message"
    target => "log"
  }

  # Extract common fields
  mutate {
    add_field => {
      "[@metadata][index_name]" => "hrms-%{+YYYY.MM.dd}"
    }
  }

  # Enrich with tenant context
  if [log][tenantId] {
    mutate {
      add_field => {
        "tenant_id" => "%{[log][tenantId]}"
      }
    }
  }

  # Parse timestamp
  if [log][timestamp] {
    date {
      match => [ "[log][timestamp]", "ISO8601" ]
      target => "@timestamp"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][index_name]}"
  }
}
```

#### 3. Elasticsearch Mapping

Create index mapping for better querying:

```bash
curl -X PUT "localhost:9200/hrms-2026.09.11?pretty" -H 'Content-Type: application/json' -d'
{
  "mappings": {
    "properties": {
      "log": {
        "properties": {
          "message": { "type": "text", "analyzer": "standard" },
          "level": { "type": "keyword" },
          "timestamp": { "type": "date" },
          "requestId": { "type": "keyword" },
          "tenantId": { "type": "keyword" },
          "userId": { "type": "keyword" },
          "userRole": { "type": "keyword" },
          "statusCode": { "type": "integer" },
          "duration": { "type": "integer" },
          "endpoint": { "type": "keyword" }
        }
      }
    }
  }
}'
```

### Kibana Queries

Access Kibana at `http://localhost:5601`

**KQL (Kibana Query Language):**
```
log.level: error AND log.tenantId: "tenant-123"
log.statusCode >= 500
log.duration > 1000
log.userId: "user-456"
```

**Query examples:**
```
# Errors by tenant
log.level: "error" | stats count() by log.tenantId

# Response times by endpoint
response_time > 1000 | stats avg(log.duration) by log.endpoint

# Failed requests by user
log.statusCode >= 400 | stats count() by log.userId

# Request correlation
log.requestId: "550e8400-e29b-41d4-a716-446655440000"
```

### Kibana Dashboards

Create a dashboard with these visualizations:

1. **Error Rate by Tenant**
   - Visualization: Bar chart
   - X-axis: log.tenantId
   - Y-axis: count() filtered by level: error
   - Time range: Last 24 hours

2. **Response Time Distribution**
   - Visualization: Histogram
   - X-axis: Buckets on log.duration (100ms intervals)
   - Y-axis: count()

3. **Top Slow Endpoints**
   - Visualization: Table
   - Columns: log.endpoint, avg(log.duration), count()
   - Sort: avg(log.duration) DESC

4. **User Activity Timeline**
   - Visualization: Area chart
   - X-axis: @timestamp
   - Y-axis: Unique values of log.userId
   - Split by log.level

## Log Querying Examples

### By Platform

#### Railway
```
In Railway dashboard:
- Filters → Add filter → Enter JSON field
- requestId = "550e8400-e29b-41d4-a716-446655440000"
- tenantId = "tenant-123"
- level = "error"
```

#### Fly.io + Better Stack
```
Better Stack query syntax:
level:error AND tenantId:"tenant-123"
requestId:"550e8400-e29b-41d4-a716-446655440000"
duration:[1000 TO 10000]
```

#### Render + Better Stack
Same as Fly.io (uses Better Stack backend)

#### Self-Hosted with ELK
```
Kibana KQL:
log.level: "error" AND log.tenantId: "tenant-123"
log.duration > 1000
log.statusCode: [400 TO 599]
```

## Common Queries

### Find all requests for a tenant
```
# Better Stack
tenantId:"tenant-123"

# Kibana
log.tenantId: "tenant-123"
```

### Find user's activity
```
# Better Stack
userId:"user-456"

# Kibana
log.userId: "user-456"
```

### Find errors by role
```
# Better Stack
userRole:"EMPLOYEE" AND level:"error"

# Kibana
log.userRole: "EMPLOYEE" AND log.level: "error"
```

### Correlate requests (end-to-end tracing)
```
# Better Stack
requestId:"550e8400-e29b-41d4-a716-446655440000"

# Kibana
log.requestId: "550e8400-e29b-41d4-a716-446655440000"
```

### Find slow requests
```
# Better Stack
duration:[1000 TO *]

# Kibana
log.duration > 1000
```

### Find failed requests
```
# Better Stack
statusCode:[400 TO 599]

# Kibana
log.statusCode >= 400
```

## Log Retention Policies

### Railway
- Default: 7 days
- No configuration needed

### Fly.io (with Better Stack)
- Using Better Stack: See Better Stack section
- Native Fly logs: 7 days

### Render (with Better Stack)
- Using Better Stack: See Better Stack section
- Native Render logs: 1-7 days

### Better Stack
- Free tier: 7 days
- Paid: Up to 30+ days configurable

### Self-Hosted ELK Stack
Configure in Elasticsearch:
```bash
# Delete logs older than 30 days daily
curl -X PUT "localhost:9200/_ilm/policy/hrms_policy?pretty" -H 'Content-Type: application/json' -d'
{
  "policy": "hrms_policy",
  "phases": {
    "hot": {
      "min_age": "0d",
      "actions": {
        "rollover": {
          "max_primary_store_size": "10gb",
          "max_age": "1d"
        }
      }
    },
    "delete": {
      "min_age": "30d",
      "actions": {
        "delete": {}
      }
    }
  }
}'
```

## Testing Log Shipping

### Verify Log Format

1. Run the application:
```bash
npm start
```

2. Make a request:
```bash
curl http://localhost:3001/api/health
```

3. Check stdout contains valid JSON:
```bash
# Should output valid JSON log entries
{"message":"Request received",...}
```

### Verify Better Stack Integration

1. Set environment variables:
```bash
LOG_SHIPPER_ENABLED=true
LOG_SHIPPER_SOURCE_TOKEN=your_token
```

2. Make requests and check Better Stack dashboard:
```bash
curl http://localhost:3001/api/health
```

3. View in Better Stack:
   - Log in to https://betterstack.com
   - Go to Logs
   - Should see logs from your app

### Verify ELK Stack Integration

1. Start ELK stack:
```bash
docker-compose -f docker-compose.elk.yml up -d
```

2. Make requests:
```bash
curl http://localhost:3001/api/health
```

3. Check Elasticsearch:
```bash
curl "localhost:9200/hrms-*/_search?pretty"
```

4. View in Kibana:
   - Go to http://localhost:5601
   - Create index pattern: `hrms-*`
   - View logs in Discover tab

## Troubleshooting

### Logs not appearing in Better Stack

1. **Check environment variable:**
```bash
# Should print "true"
echo $LOG_SHIPPER_ENABLED

# Should print your token
echo $LOG_SHIPPER_SOURCE_TOKEN
```

2. **Check Better Stack token:**
   - Get token from Better Stack dashboard
   - Verify it starts with expected characters
   - Token should not be truncated

3. **Check network connectivity:**
```bash
# From within container
curl -X POST https://in.betterstack.com/api/v1/logs \
  -H "Authorization: Bearer your_token" \
  -d '{"logs": [{"message": "test"}]}'
```

4. **Check fallback log file:**
```bash
# Logs queued locally if remote failed
tail -f /tmp/logs-fallback.jsonl
```

### Logs not valid JSON

1. **Check JSON format:**
```bash
# All log lines should be valid JSON
docker logs container_name | head -1 | jq .
```

2. **Check for console.log calls:**
   - All logging must use LoggerService
   - Never use console.log directly
   - Search: `grep -r "console\.log" src/`

3. **Check for newlines in messages:**
   - Log messages must be single line
   - Use JSON fields for complex data

### High log volume consuming memory

1. **Reduce DEBUG logs:**
```bash
# In production, only enable info/warn/error
LOG_LEVEL=info
```

2. **Increase batch size:**
   - Modify LogShipperService: `BATCH_SIZE`
   - Default: 50 logs per batch

3. **Reduce batch interval:**
   - Modify LogShipperService: `BATCH_INTERVAL_MS`
   - Default: 5000ms (5 seconds)

### Missing tenant/user context

1. **Check authentication:**
   - Is JWT being set correctly?
   - Check token contains `tenantId` and `sub`

2. **Check middleware order:**
   - RequestContextMiddleware must run before auth
   - Check app.module.ts middleware configuration

3. **Debug context:**
   - Add log with `this.logger.info('Debug', { all: this.logger.context })`
   - Check all expected fields are present

## Implementation Checklist

- ✅ LoggerService outputs JSON to stdout
- ✅ RequestContextMiddleware captures request ID and user context
- ✅ LogShipperService batches and ships to Better Stack
- ✅ Fallback storage for when remote service unavailable
- ✅ Environment variables documented in .env.example
- ✅ All platforms (Railway, Fly.io, Render) supported
- ✅ Query examples provided for each platform
- ✅ ELK Stack setup documented
- ✅ Log retention policies defined
- ✅ Testing procedures documented
- ✅ Troubleshooting guide provided

## Integration for Other Agents

### For Feature Development

1. **Inject LoggerService:**
```typescript
constructor(private readonly logger: LoggerService) {}
```

2. **Use for logging:**
```typescript
this.logger.info('User login successful', { userId: user.id });
this.logger.error('Database error', error.stack, { query: 'SELECT...' });
```

3. **No need to pass context:**
   - RequestContextMiddleware sets it automatically
   - requestId, tenantId, userId, userRole all captured

### For Deployment

1. **Set log shipper variables:**
   - `LOG_SHIPPER_ENABLED=true` (production only)
   - `LOG_SHIPPER_SOURCE_TOKEN=your_token`

2. **Verify before deployment:**
   - Test locally: `npm start`
   - Make requests
   - Verify JSON in stdout

3. **Monitor after deployment:**
   - Check Better Stack/ELK logs flowing
   - Set up error alerts
   - Monitor log volume

## Cost Estimation

### Railway
- **Cost**: Free (included in hosting)
- **Volume limit**: No limit

### Fly.io
- **Cost**: Free (7 days native logs)
- **Better Stack**: $5-20/month for typical volume

### Render
- **Cost**: Free (1-7 days native logs)
- **Better Stack**: $5-20/month for typical volume

### Better Stack Standalone
- **Free tier**: 50 GB/month
- **Typical HRMS**: 100-500 MB/day = $5-20/month

### Self-Hosted ELK Stack
- **Cost**: Infrastructure only (EC2 t2.medium = ~$30/month)
- **Volume**: Minimal (< 10GB disk for 30 days typical usage)
- **Total**: ~$30-50/month

---

**Implementation Date**: September 11, 2026
**Status**: Complete and Ready for Use
**Last Updated**: 2026-09-11
