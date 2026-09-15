# Phase 4 Validation Checklist

This document provides a comprehensive checklist for validating Phase 4 (Docker & Containerization) implementation.

## Quick Start

Run the validation suite in order:

```bash
# 1. Quick component validation (5 min)
./scripts/test-phase4.sh

# 2. Full smoke tests with services running (10 min)
./scripts/smoke-tests.sh

# 3. Database integrity tests (5 min)
./scripts/test-database.sh

# 4. Load testing and performance (varies)
./scripts/load-test.sh
```

## Docker Build Validation

### Dockerfile Build
- [ ] Dockerfile builds without errors: `docker build -f api/Dockerfile -t orbit-hr-api:test .`
- [ ] Build completes within reasonable time (< 5 minutes)
- [ ] No warnings about deprecated directives
- [ ] Multi-stage build optimization is used
- [ ] Builder stage uses `node:22-alpine`
- [ ] Production stage uses `node:22-alpine`

### Docker Image Size
- [ ] Image size is acceptable: `docker images orbit-hr-api:test --format "{{.Size}}"`
- [ ] Image size is less than 500MB (target: 180-220MB)
- [ ] Only production dependencies are included
- [ ] Source code is not included in final image
- [ ] Builder stage artifacts are not in final image

### Image Layers and Content
- [ ] `docker history orbit-hr-api:test` shows expected layers
- [ ] `.dockerignore` is present and properly configured
- [ ] Unnecessary files are excluded from build context
- [ ] dist/ directory is present in final image
- [ ] node_modules/ contains only production dependencies

## Docker Compose Validation

### Compose File Structure
- [ ] `docker-compose.staging.yml` exists in project root
- [ ] File is valid YAML: `docker-compose -f docker-compose.staging.yml config`
- [ ] All required services are defined (postgres, api, web)
- [ ] Service names match expected names (hrms-postgres-staging, hrms-api-staging, hrms-web-staging)
- [ ] Services use correct images and tags

### Service Configuration
- [ ] PostgreSQL service configured correctly
- [ ] API service configured with health checks
- [ ] Web service configured with proper environment variables
- [ ] All services have restart policies
- [ ] Volume configuration is correct

### Networking
- [ ] Network `staging` is defined and used by all services
- [ ] Services can communicate with each other
- [ ] External ports are correctly mapped

## Environment Variables

### Environment Variable Files
- [ ] `.env.staging` exists and contains all required variables
- [ ] `.env.test` exists for test scenarios
- [ ] `api/.env.example` exists with example values
- [ ] No secrets are committed to version control

### Required Variables (Staging)
- [ ] POSTGRES_USER is set
- [ ] POSTGRES_PASSWORD is secure
- [ ] POSTGRES_DB is set correctly
- [ ] DATABASE_URL is correctly formatted
- [ ] DIRECT_DATABASE_URL is correctly formatted
- [ ] JWT_SECRET is secure
- [ ] JWT_EXPIRES_IN is configured
- [ ] NODE_ENV is set to production
- [ ] PORT is set to 3001
- [ ] WEB_ORIGIN is set correctly
- [ ] NEXT_PUBLIC_API_URL is set for web service

## Health Checks

### API Health Check
- [ ] Health check endpoint implemented at `/api/health`
- [ ] Endpoint returns HTTP 200 when healthy
- [ ] Container reports healthy status after startup

### Service Startup
- [ ] PostgreSQL starts and becomes healthy within 30 seconds
- [ ] API starts after PostgreSQL is healthy
- [ ] API health check passes within 60 seconds
- [ ] All services are running: `docker ps`

## Database

### Database Migrations
- [ ] Prisma schema file exists
- [ ] Migrations run automatically on container startup
- [ ] No pending migrations
- [ ] All migration files are in version control

### Database Schema
- [ ] Tables are created according to schema
- [ ] Required tables exist
- [ ] Indexes are created as defined
- [ ] Constraints are properly set up

### Row-Level Security (RLS)
- [ ] RLS policies are enforced on tables
- [ ] Tenant isolation is maintained
- [ ] Restricted role cannot bypass RLS

## Service Connectivity

### Internal Service Communication
- [ ] API can connect to PostgreSQL
- [ ] Web frontend can connect to API
- [ ] Services communicate via container network

### External Connectivity
- [ ] API is accessible at http://localhost:3001/api
- [ ] API health check at http://localhost:3001/api/health
- [ ] Web frontend is accessible at http://localhost:3000
- [ ] Database is accessible at localhost:5432

## Performance

### Container Performance
- [ ] PostgreSQL starts within 30 seconds
- [ ] API starts within 60 seconds
- [ ] Memory usage is reasonable
- [ ] CPU usage is acceptable

### Response Times
- [ ] Health check responds within 500ms
- [ ] API endpoints respond within 1 second
- [ ] Database queries complete in reasonable time

## Security

### Container Security
- [ ] Non-root user is used in API container
- [ ] File permissions are restrictive
- [ ] No secrets hardcoded in images
- [ ] JWT secret is sufficiently long

### Secret Management
- [ ] Secrets are passed via environment variables
- [ ] .env files are in .gitignore
- [ ] No secrets in logs
- [ ] Default passwords are changed for production

## Documentation

### Documentation Files
- [ ] `PHASE4_STATUS.md` is complete
- [ ] `DEPLOYMENT_CHECKLIST.md` exists
- [ ] `PHASE4_VALIDATION.md` is present
- [ ] README.md mentions Docker setup

## Testing

### Integration Tests
- [ ] `scripts/test-phase4.sh` validates all components
- [ ] `scripts/smoke-tests.sh` tests critical endpoints
- [ ] `scripts/test-database.sh` validates database
- [ ] `scripts/load-test.sh` tests performance

### Test Results
- [ ] All validation tests pass
- [ ] All smoke tests pass
- [ ] All database tests pass
- [ ] Load tests show acceptable performance

## Test Scripts

### test-phase4.sh
Quick validation of all Phase 4 components:
- Checks Docker installation
- Validates Dockerfile
- Validates docker-compose
- Checks environment variables
- Tests Dockerfile build
- Validates required files
- Checks health configuration

Runtime: 5 minutes (or 30s with SKIP_DOCKER_BUILD=1)

```bash
./scripts/test-phase4.sh
# or skip docker build
SKIP_DOCKER_BUILD=1 ./scripts/test-phase4.sh
```

### smoke-tests.sh
Full integration test with services running:
- Starts Docker containers
- Waits for services to become healthy
- Tests critical endpoints
- Checks environment configuration
- Verifies frontend responds

Runtime: 5-10 minutes

```bash
./scripts/smoke-tests.sh
```

### test-database.sh
Database schema and integrity tests:
- Checks PostgreSQL is running
- Verifies database exists
- Counts tables in schema
- Checks migrations are applied
- Verifies RLS policies

Runtime: 2-5 minutes

```bash
./scripts/test-database.sh
```

### load-test.sh
Load testing and performance validation:
- Detects available load testing tools
- Runs load tests with configurable concurrency
- Measures response times
- Reports success/failure rates

Runtime: 1-5 minutes (configurable)

```bash
./scripts/load-test.sh

# With custom configuration
LOAD_TEST_CONCURRENCY=20 LOAD_TEST_DURATION=60 ./scripts/load-test.sh
```

## Troubleshooting

### Docker Build Fails
```bash
# Check Docker logs
docker buildx du

# Clean and rebuild
docker system prune -a
docker build -f api/Dockerfile -t orbit-hr-api:test .
```

### Services Won't Start
```bash
# Check Docker daemon
docker ps

# View service logs
docker-compose -f docker-compose.staging.yml logs postgres
docker-compose -f docker-compose.staging.yml logs api
```

### Database Connection Issues
```bash
# Test PostgreSQL connectivity
docker exec hrms-postgres-staging psql -U postgres -d orbit_hr -c "SELECT 1"

# Check database logs
docker-compose -f docker-compose.staging.yml logs postgres | tail -50
```

### Health Check Failures
```bash
# Test health endpoint directly
curl -v http://localhost:3001/api/health

# Check API logs
docker-compose -f docker-compose.staging.yml logs -f api
```

## Performance Benchmarks

### Target Metrics
- API startup time: < 30 seconds
- Health check response: < 500ms
- API endpoint response: < 1 second
- Database query time: < 100ms
- Image build time: < 5 minutes
- Image size: < 500MB (target: 180-220MB)

### Monitoring
```bash
# Watch container stats
docker stats --no-stream

# Monitor logs in real-time
docker-compose -f docker-compose.staging.yml logs -f
```

---

Created: 2026-09-10
Status: Phase 4 Testing Framework
