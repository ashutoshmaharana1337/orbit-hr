# Phase 4: Database Migration & Schema Management

**Date:** September 10, 2026  
**Status:** Implementation Ready  
**Objective:** Establish production-grade database migration and schema management procedures

## Overview

Phase 4 implements comprehensive database migration management, schema documentation, and deployment workflows. This ensures safe, auditable schema changes across all environments with proper testing and rollback procedures.

### Key Deliverables
1. ✅ Database migration wrapper scripts
2. ✅ Migration testing automation
3. ✅ Production release workflow with backup
4. ✅ Comprehensive schema documentation
5. ✅ Migration checklist and best practices
6. ✅ Rollback procedures and recovery plans

## Implementation Status

### 1. Migration Scripts

#### `scripts/migrate.sh`
Database migration wrapper with safe operations:

```bash
# Deploy pending migrations (production release)
./scripts/migrate.sh deploy

# Reset development database
./scripts/migrate.sh reset

# Populate sample data
./scripts/migrate.sh seed

# Check migration status
./scripts/migrate.sh status
```

**Status:** ✅ COMPLETE  
**Usage:** CI/CD pipelines, manual deployments, development workflows

#### `scripts/test-migration.sh`
Automated migration testing on temporary database:

```bash
# Test migrations in isolated environment
./scripts/test-migration.sh

# Exit codes:
# 0 = Success
# 1 = Configuration error
# 2 = Migration failed
# 3 = Schema validation failed
```

**Features:**
- Creates temporary test database
- Runs all pending migrations
- Validates schema against Prisma schema
- Cleans up test database
- Reports success/failure

**Status:** ✅ COMPLETE  
**Prerequisites:**
- PostgreSQL client tools (psql, pg_dump)
- Environment variables: DATABASE_URL, DIRECT_DATABASE_URL (optional)

#### `scripts/release.sh`
Production release workflow with database safety:

```bash
# Full release with backup, migration, validation
./scripts/release.sh

# Or with forced release (CI/CD)
FORCE_RELEASE=1 ./scripts/release.sh
```

**Workflow:**
1. Validate environment and prerequisites
2. Backup database (if backup tools available)
3. Run pending migrations
4. Validate migration completion
5. Health check API
6. Provide rollback instructions

**Status:** ✅ COMPLETE  
**Exit Codes:**
- 0: Success
- 1: Validation failed
- 2: Backup failed (non-blocking)
- 3: Migration failed
- 4: Health check failed (non-blocking)

### 2. Documentation

#### `docs/MIGRATIONS.md`
Comprehensive migration management guide:

- Pre-deployment checklist
- Migration review procedures
- Staging test process
- Deployment order and sequence
- Script usage examples
- Creating new migrations
- Handling common issues
- Rollback strategies
- Environment-specific notes
- Monitoring and validation

**Status:** ✅ COMPLETE  
**Audience:** DevOps, Database Admins, Release Engineers

#### `api/prisma/migrations/README.md`
Migration repository documentation:

- Overview of all migrations
- Migration timeline with descriptions
- Schema entity reference
- Migration file structure
- Deployment procedures
- Version tracking
- Common tasks
- Best practices
- Troubleshooting

**Status:** ✅ COMPLETE  
**Audience:** Developers, DevOps, Database Teams

#### `api/prisma/schema.prisma`
Enhanced schema documentation:

- Detailed comments on all models
- Enum purpose documentation
- Relationship explanations
- Field descriptions
- Business logic notes
- Security considerations

**Status:** ✅ COMPLETE  
**Changes:**
```prisma
// Before: Minimal inline comments
model Tenant {
  id String @id @default(uuid())
  // ...
}

// After: Comprehensive documentation
// Tenant - Multi-tenant isolation unit
// Represents a separate organization...
model Tenant {
  id String @id @default(uuid())  // Primary identifier
  // ...
}
```

### 3. Deployment Workflow

#### Pre-Deployment Phase

**1. Schema Review**
- Review changes in `api/prisma/schema.prisma`
- Check migrations in `api/prisma/migrations/`
- Verify field types and constraints
- Check relationship configurations

**2. Migration Validation**
```bash
cd api
npx prisma validate
```

**3. Testing on Staging**
```bash
# Test migrations against staging database
./scripts/test-migration.sh

# Environment: STAGING
# Database: staging.example.com
```

**4. Approval**
- Code review of schema and migration changes
- DevOps approval for release
- Stakeholder notification

#### Deployment Phase

**1. Pre-Migration Backup**
```bash
# Automated by release.sh
pg_dump -F c -b -v -f backups/hrms_backup_$(date +%Y%m%d_%H%M%S).sql $DATABASE_URL
```

**2. Run Migrations**
```bash
# Via release.sh (recommended)
./scripts/release.sh

# Or manual deployment
cd api
npx prisma migrate deploy
```

**3. Validate Migrations**
```bash
npx prisma migrate status
```

**4. Start API Services**
```bash
# AFTER migrations complete
docker-compose up api
```

#### Post-Deployment Phase

**1. Health Checks**
```bash
curl https://api.example.com/health
```

**2. Smoke Tests**
```bash
npm test  # Run API test suite
```

**3. Monitoring**
- Database performance metrics
- Application error rates
- API response times

**4. Documentation**
- Update CHANGELOG.md
- Record migration details
- Document any manual steps

### 4. Deployment Order (Critical)

Migrations MUST run before API servers start:

```
1. Database Backup
   ↓
2. Migration: npx prisma migrate deploy
   ↓
3. Validation: npx prisma migrate status
   ↓
4. API Server Startup
   ↓
5. Health Checks
```

**Never:**
- ❌ Start API before migrations complete
- ❌ Run migrations in parallel
- ❌ Skip validation steps
- ❌ Run migrations at container startup (use init container or release step)

### 5. Rollback Procedures

#### Quick Rollback (Database Restore)

**If migration fails:**

1. Stop API servers
2. Restore from backup
   ```bash
   pg_restore -d $DATABASE_URL backups/hrms_backup_TIMESTAMP.sql
   ```
3. Verify database state
4. Restart API servers

**Timeline:** ~5-15 minutes

**Data Loss:** None (using backup)

#### Migration-Specific Rollback

**For reversible migrations:**

1. Identify previous migration
   ```bash
   npx prisma migrate status
   ```

2. Review rollback SQL
   ```bash
   cat api/prisma/migrations/[previous_migration]/migration.sql
   ```

3. Execute rollback (manual SQL if needed)

4. Restart API

**Timeline:** ~2-10 minutes

**Data Loss:** None (if proper migration written)

#### Data Recovery

**For data loss situations:**

1. Restore latest backup
2. Reapply migrations
3. Validate data integrity
4. Contact DevOps + Database team

**Timeline:** ~30+ minutes

**Prevention:** Always test on staging first

### 6. Migration Checklist

Use before deploying ANY migration:

```markdown
- [ ] Schema changes reviewed
- [ ] Migration SQL reviewed
- [ ] No unintended data loss
- [ ] Tested on staging database
- [ ] Database backup verified
- [ ] Rollback plan documented
- [ ] Performance impact assessed
- [ ] Team approval obtained
- [ ] Deployment window scheduled
- [ ] Communication sent to stakeholders
```

### 7. Environment-Specific Configuration

#### Development
- Migrations apply automatically via Prisma
- Can reset with `prisma migrate reset`
- No backup needed
- Unreleased migrations can be modified

#### Staging
- Mirrors production setup
- Database snapshot monthly
- Full release rehearsal before production
- All scripts validated

#### Production
- Migrations are release-critical
- Backup ALWAYS before deployment
- Deploy during low-traffic window
- Monitor for errors and performance

### 8. Current Migration State

**Total Migrations:** 12  
**Current Schema Version:** 20260910172128  
**Last Migration:** Add Department Table (Phase 3)

**Key Features Deployed:**
- ✅ Multi-tenant isolation (Tenant table)
- ✅ Authentication (User, RefreshToken, PasswordSetToken)
- ✅ Employee management (Employee, Department)
- ✅ Attendance tracking (AttendanceRecord)
- ✅ Leave management (LeaveRequest, LeavePolicy, LeaveBalance)
- ✅ Audit logging (AuditLog)
- ✅ Soft deletes (Employee.deletedAt)
- ✅ Row-level security (PostgreSQL RLS)

### 9. Testing Strategy

#### Unit Testing
- Prisma schema validation
- Migration SQL syntax
- Field constraints

#### Integration Testing
- Migration execution on test database
- Schema change validation
- Relationship integrity

#### Staging Testing
- Full migration workflow
- Performance impact
- Data migration correctness
- Rollback procedures

#### Production Safety
- Pre-deployment backup
- Validation after deployment
- Health checks
- Error monitoring

## Scripts Reference

### Quick Commands

```bash
# Check migration status
./scripts/migrate.sh status

# Deploy to production
./scripts/release.sh

# Test migrations safely
./scripts/test-migration.sh

# Create new migration
cd api && npx prisma migrate dev --name [name]

# Reset development database
./scripts/migrate.sh reset

# Seed sample data
./scripts/migrate.sh seed
```

## Documentation References

- [Migration Management Guide](MIGRATIONS.md)
- [Migration Repository Docs](../api/prisma/migrations/README.md)
- [Prisma Migration Docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate)

## Integration with CI/CD

### GitHub Actions (Recommended)

```yaml
# In .github/workflows/deploy.yml
- name: Test Migrations
  run: ./scripts/test-migration.sh

- name: Deploy
  run: FORCE_RELEASE=1 ./scripts/release.sh
  
- name: Health Check
  run: npm test
```

### Manual Deployment

```bash
# Run all checks and deploy
./scripts/release.sh

# Follow on-screen prompts and instructions
```

## Known Limitations

1. **Manual Rollback Required**
   - Prisma doesn't auto-generate rollback migrations
   - Keep backup for manual recovery
   - Document complex migration rollback steps

2. **PostgreSQL Specific**
   - RLS policies PostgreSQL-only
   - Scripts use psql (PostgreSQL client)
   - Not compatible with other databases

3. **Zero-Downtime Migrations**
   - Requires careful planning for large tables
   - Breaking schema changes may need coordination
   - Document data migration procedures

## Future Improvements

### Phase 5 Candidates
- [ ] Automated zero-downtime migration detection
- [ ] Blue-green database schema patterns
- [ ] Advanced monitoring and alerting
- [ ] Migration simulation and forecasting
- [ ] Self-service rollback UI

### Post-Production
- [ ] Historical schema visualization
- [ ] Migration performance analytics
- [ ] Automated backup retention policies
- [ ] Advanced RLS policy management

## Support & Contacts

### Deployment Issues
- Check [MIGRATIONS.md](MIGRATIONS.md#troubleshooting)
- Review migration logs
- Check database connectivity

### Schema Questions
- Review [schema.prisma](../api/prisma/schema.prisma)
- Check [Prisma docs](https://www.prisma.io/docs)

### Emergency Support
- DevOps team: [Slack/Contact]
- Database team: [Slack/Contact]
- On-call: [Runbook link]

## Sign-Off

Phase 4 Implementation: **COMPLETE**

### Verified By
- ✅ Schema documentation: Complete
- ✅ Migration scripts: Tested
- ✅ Deployment workflows: Documented
- ✅ Rollback procedures: Established
- ✅ Team training: Ready

### Ready For
- ✅ Phase 3 data migration
- ✅ Production deployment
- ✅ CI/CD integration
- ✅ Ongoing schema management

---

**Last Updated:** 2026-09-10  
**Maintained By:** DevOps & Database Teams  
**Next Review:** After Phase 3 Production Deployment
