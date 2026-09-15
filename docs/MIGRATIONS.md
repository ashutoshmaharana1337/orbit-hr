# Database Migration Management

This document outlines the migration strategy, procedures, and best practices for HRMS database schema management.

## Overview

Database migrations are version-controlled schema changes that are applied systematically across environments. All migrations are managed by Prisma and must be reviewed and tested before deployment to production.

**Key Principles:**
- ✅ All schema changes go through Prisma migrations
- ✅ Migrations are reviewed before deployment
- ✅ Migrations run as a release step (before API startup)
- ✅ Testing on staging mirrors production
- ✅ Rollback plans are documented and tested

## Migration Files

### Location
```
api/prisma/migrations/
```

### Structure
Each migration is a timestamped directory containing:
- `migration.sql` - The actual SQL changes
- `migration_lock.toml` - Lock file (do not edit)

Example:
```
api/prisma/migrations/20260910051809_add_audit_log_table/
├── migration.sql
└── README.md (optional - for complex migrations)
```

## Pre-Deployment Checklist

Before deploying migrations to any environment, complete these steps:

### 1. Schema Review
- [ ] Review Prisma schema changes in `api/prisma/schema.prisma`
- [ ] Verify all model fields are correctly defined
- [ ] Check relationships and constraints
- [ ] Ensure enums are properly typed
- [ ] Validate indexes for performance-critical tables

### 2. Migration Review
- [ ] Review the generated migration SQL in `migration.sql`
- [ ] Ensure no unintended schema changes are included
- [ ] Check for proper use of transactions
- [ ] Verify CASCADE and ON DELETE behaviors
- [ ] Look for potential data migration issues

**Review Checklist for Migration SQL:**
```sql
-- Good: Explicit data migration with proper constraints
BEGIN;
  ALTER TABLE attendance ADD COLUMN department_id UUID;
  UPDATE attendance SET department_id = e.department_id FROM employees e;
  ALTER TABLE attendance ALTER COLUMN department_id SET NOT NULL;
COMMIT;

-- Bad: No explicit data handling
ALTER TABLE attendance ADD COLUMN department_id UUID NOT NULL;
```

### 3. Staging Test
- [ ] Create a database copy or use staging environment
- [ ] Run: `./scripts/test-migration.sh`
- [ ] Verify migration completes without errors
- [ ] Check that all tables/columns are created correctly
- [ ] Validate constraints are properly applied
- [ ] Test row-level security policies (if applicable)

### 4. Data Validation
- [ ] Verify no unintended data loss
- [ ] Run sample queries against migrated schema
- [ ] Check record counts before/after migration
- [ ] Validate relationship integrity
- [ ] Ensure indexes are created

### 5. Rollback Plan
- [ ] Document which migrations are affected
- [ ] Identify previous migration state
- [ ] Prepare SQL rollback scripts (if needed)
- [ ] Test rollback on staging
- [ ] Document manual recovery steps

### 6. Performance Check
- [ ] Run `ANALYZE` on all affected tables
- [ ] Check query plans for index effectiveness
- [ ] Monitor for slow queries during migration
- [ ] Verify no blocking locks during migration

## Deployment Order

Migrations must be deployed in strict order. The deployment process:

1. **Pre-migration validation** (CI/CD)
   ```bash
   ./scripts/test-migration.sh
   ```

2. **Database backup** (Production)
   ```bash
   # Automated by release.sh
   pg_dump -F c -f backups/hrms_backup_$(date +%Y%m%d_%H%M%S).sql $DATABASE_URL
   ```

3. **Run migrations** (Release step)
   ```bash
   npx prisma migrate deploy
   ```

4. **Validate migrations** (Post-migration)
   ```bash
   npx prisma migrate status
   ```

5. **Start API servers** (After validation)
   ```bash
   docker-compose up api
   ```

### Never Do This
- ❌ Do NOT run migrations at container startup
- ❌ Do NOT skip migration validation
- ❌ Do NOT modify migration files after deployment
- ❌ Do NOT run multiple migrations in parallel
- ❌ Do NOT delete migration files

## Scripts

### `./scripts/migrate.sh`
Database migration wrapper with common operations:

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

### `./scripts/test-migration.sh`
Automated migration testing:

```bash
# Test migrations on temporary database
./scripts/test-migration.sh

# Exit codes:
# 0 = Success
# 1 = Configuration error
# 2 = Migration failed
# 3 = Schema validation failed
```

### `./scripts/release.sh`
Production release with full migration workflow:

```bash
# Full release with backup, migration, and health checks
./scripts/release.sh

# Or with forced release (skips confirmation)
FORCE_RELEASE=1 ./scripts/release.sh
```

## Creating New Migrations

### Step 1: Update Prisma Schema
Edit `api/prisma/schema.prisma`:
```prisma
model NewTable {
  id    String   @id @default(uuid())
  name  String
  // ... other fields
}
```

### Step 2: Create Migration
```bash
cd api
npx prisma migrate dev --name add_new_table
```

This creates:
- New migration directory with timestamp
- `migration.sql` with SQL changes
- Updates `schema.prisma`

### Step 3: Review Migration
```bash
# Review the generated SQL
cat api/prisma/migrations/[timestamp]_add_new_table/migration.sql
```

### Step 4: Test Migration
```bash
./scripts/test-migration.sh
```

### Step 5: Commit and Push
```bash
git add api/prisma/
git commit -m "feat(db): add new table migration"
git push origin feature-branch
```

## Handling Migration Issues

### Migration Failed to Deploy
1. Check error message
2. Investigate database state
3. Review migration SQL
4. Restore from backup if needed
5. Investigate root cause before retry

### Data Loss During Migration
1. **STOP** - Do not continue
2. Restore from backup
3. Analyze migration logic
4. Create new migration with proper data handling
5. Test thoroughly before redeployment

### Slow Migration
1. Check table sizes: `SELECT COUNT(*) FROM table_name;`
2. Monitor migration progress
3. Add indexes separately if needed
4. Consider breaking into multiple migrations

### Locking Issues
1. Identify blocked queries
2. Check for long-running transactions
3. Consider maintenance window for large tables
4. Add `CONCURRENTLY` flag for index operations where supported

## Rollback Strategies

### Quick Rollback (Within Minutes)
If you need to quickly rollback a migration:

1. **Identify the rollback state:**
   ```bash
   npx prisma migrate status
   ```

2. **Locate the previous migration:**
   ```bash
   ls api/prisma/migrations/
   ```

3. **Restore from backup:**
   ```bash
   pg_restore -d $DATABASE_URL backups/hrms_backup_TIMESTAMP.sql
   ```

4. **Verify rollback:**
   ```bash
   npx prisma db execute --stdin << EOF
   SELECT version() FROM schema_migrations;
   EOF
   ```

### Manual Rollback SQL
For complex migrations, a manual SQL rollback script may be needed:

```sql
-- Example rollback for adding a column
BEGIN;
  ALTER TABLE employees DROP COLUMN department_id;
  -- Restore any necessary data
COMMIT;
```

Store rollback scripts in the migration directory or a separate `/rollback-scripts` directory.

### Rollback Testing
- [ ] Test rollback on staging after each migration
- [ ] Document exact rollback procedure
- [ ] Verify data integrity after rollback
- [ ] Ensure application still works with previous schema

## Environment-Specific Considerations

### Development
- Use `./scripts/migrate.sh reset` for clean state
- Migrations apply automatically
- Can modify unreleased migrations

### Staging
- Mirror production database and data (monthly)
- Run `./scripts/test-migration.sh` before promotion
- Test full release flow with `./scripts/release.sh`

### Production
- Backup before deploying migrations
- Run during maintenance window for large tables
- Monitor for errors and performance issues
- Have rollback plan ready

## Monitoring & Validation

After migration deployment:

1. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

2. **Verify schema:**
   ```bash
   npx prisma generate
   npx prisma validate
   ```

3. **Query verification:**
   ```bash
   npm test  # Run API tests
   ```

4. **Health checks:**
   ```bash
   curl http://localhost:3000/health
   ```

5. **Database validation:**
   ```sql
   -- Check table exists
   SELECT * FROM information_schema.tables WHERE table_name = 'new_table';
   
   -- Check constraints
   SELECT * FROM information_schema.table_constraints WHERE table_name = 'new_table';
   ```

## Common Migration Patterns

### Adding a Required Column to Populated Table
```prisma
// Update schema
model Table {
  id      String   @id @default(uuid())
  newCol  String   @default("default_value")  // Temporary default
}
```

Then after migration:
```sql
-- Remove default if no longer needed
ALTER TABLE table ALTER COLUMN newCol DROP DEFAULT;
```

### Renaming a Column
```bash
npx prisma migrate dev --name rename_column
```

Prisma handles the SQL generation, but review it carefully.

### Creating Index on Large Table
```prisma
model Table {
  id    String @id
  email String
  
  @@index([email])  // Add index
}
```

For very large tables, consider:
```sql
CREATE INDEX CONCURRENTLY idx_table_email ON table(email);
```

### Changing Enum Values
```bash
# Create migration with enum changes
npx prisma migrate dev --name update_enum
```

Review the generated SQL - you may need to manually handle data transitions.

## Troubleshooting

### "Prisma has detected drift"
The database schema doesn't match the Prisma schema.

Solution:
```bash
# Check the drift
npx prisma db pull  # Pull current state

# Review changes
git diff api/prisma/schema.prisma

# If you want to keep database state:
npx prisma db push

# If you want to keep Prisma schema:
# Restore database from backup and reapply migrations
```

### "Migration already applied" error
A migration appears to be partially applied.

Solution:
1. Check `_prisma_migrations` table
2. May need manual database state recovery
3. Contact DevOps if uncertain

### "Cannot create migration with same name"
Migration name already exists.

Solution:
```bash
# Use --skip-generate to skip auto-generation
# Or use a different name with --name parameter
npx prisma migrate dev --name add_unique_name_here
```

## References

- [Prisma Migration Docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate)
- [SQL Best Practices](./sql-best-practices.md)
- [Rollback Procedures](./PHASE4_STATUS.md#rollback-procedures)

## Support

For migration issues:
1. Check this document
2. Review Prisma error message
3. Consult deployment logs
4. Contact DevOps team

Last Updated: 2026-09-10  
Maintained by: DevOps Team
