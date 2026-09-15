# Database Migrations

This directory contains all database migrations for the HRMS system. Each migration represents a versioned change to the database schema.

## Overview

Migrations are applied in chronological order by timestamp. They ensure the database schema evolves consistently across all environments (development, staging, production).

**Current Schema Version:** 20260910172128 (Phase 3 Complete)

## Migration Timeline

All migrations are listed below in deployment order. Each migration builds on the previous state.

### Phase 1: Initial Setup
- **20260902115104_init** - Initial schema with core tables
  - Tenant, User, Employee, Department, AttendanceRecord, LeaveRequest
  - Core enums (UserRole, EmployeeStatus, AttendanceStatus, LeaveType, LeaveStatus)
  - Indexes and relationships

- **20260902173418_unique_user_email** - Add unique constraint on user email
  - Ensures email uniqueness across the system

### Phase 2: Authentication & Security
- **20260907053003_add_refresh_tokens** - Add RefreshToken table
  - Support for JWT refresh token management
  - Token revocation capability

- **20260907101235_add_password_set_tokens** - Add PasswordSetToken table
  - Support for password reset/invite flows
  - Token expiration tracking

- **20260907102820_add_tenant_timezone_settings** - Add timezone configuration
  - Tenant-level timezone settings for attendance calculations
  - Late cutoff minute settings

- **20260907112910_enable_row_level_security** - Enable PostgreSQL RLS
  - Row-level security policies for data isolation
  - Tenant-scoped data access

- **20260907113750_fix_tenant_rls_returning** - Fix RLS returning clauses
  - Correction to RLS policies for proper INSERT/UPDATE/DELETE behavior

### Phase 3: Business Features
- **20260910051809_add_audit_log_table** - Add AuditLog table
  - Comprehensive audit logging for compliance
  - Tracks CREATE, UPDATE, DELETE operations

- **20260910114646_add_leave_policies_and_update_balances** - Add LeavePolicy and restructure LeaveBalance
  - LeavePolicy for configurable leave entitlements
  - Redesigned LeaveBalance with year-scoping and policy association
  - Support for variable working days and public holidays

- **20260910171855_add_soft_delete_to_employee** - Add soft delete support
  - deletedAt field for employee soft deletion
  - Enables data recovery and compliance

- **20260910172128_add_department_table** - Add Department table
  - Department management as standalone entity
  - Many-to-many relationship with employees

## Schema Entities

### Core Entities
- **Tenant** - Multi-tenant isolation unit
- **User** - Authentication and authorization
- **Employee** - Employee records with department and manager relationships

### Business Entities
- **Department** - Department management
- **AttendanceRecord** - Daily attendance tracking
- **LeaveRequest** - Leave request submissions
- **LeavePolicy** - Leave entitlements and rules
- **LeaveBalance** - Year-scoped leave balance tracking

### Security & Audit
- **RefreshToken** - JWT refresh token management
- **PasswordSetToken** - Password reset/invite token handling
- **AuditLog** - Complete audit trail

## Migration File Structure

Each migration directory contains:

```
[timestamp]_[name]/
├── migration.sql          # The SQL DDL/DML changes
└── README.md             # (Optional) Complex migration notes
```

Example:
```
20260910051809_add_audit_log_table/
├── migration.sql          # ~50 lines of SQL for AuditLog table creation
└── (notes on RLS policies if complex)
```

## How to Deploy Migrations

### Automated Deployment (CI/CD)
```bash
# During release process
./scripts/release.sh
```

### Manual Deployment
```bash
# Deploy pending migrations
./scripts/migrate.sh deploy

# Check status
./scripts/migrate.sh status
```

### Testing
```bash
# Test migrations on temporary database
./scripts/test-migration.sh
```

## Important Notes

### Version Tracking
Prisma stores applied migrations in the `_prisma_migrations` table:
- Stores migration name, checksum, and application timestamp
- Prevents duplicate applications
- Enables rollback capability

### Immutability
- ✅ Never modify a migration after it's deployed to production
- ✅ Never rename migration directories
- ✅ Never delete migration files

If a migration needs changes:
1. Create a new migration that undoes the previous one
2. Apply corrections in the new migration
3. Both migrations remain in history

### Rollback
Prisma migrations don't have built-in automatic rollback. For recovery:
1. Use database backup: `pg_restore`
2. Or create a new migration to undo changes

See [docs/MIGRATIONS.md](../../MIGRATIONS.md#rollback-strategies) for detailed rollback procedures.

## Common Tasks

### View Applied Migrations
```bash
npx prisma migrate status
```

Output shows:
- Applied migrations with timestamps
- Any pending migrations
- Migration history

### Create New Migration
```bash
# Update schema.prisma first, then:
npx prisma migrate dev --name descriptive_name
```

### Reset Development Database
```bash
# ⚠️ Data loss - development only!
npx prisma migrate reset --force
```

### Validate Current Schema
```bash
npx prisma validate
```

## Best Practices

1. **Review Before Deployment**
   - Always review generated SQL
   - Check for data migration issues
   - Test on staging first

2. **Use Descriptive Names**
   ```
   Good:   add_audit_log_table
   Bad:    update_schema
   ```

3. **Keep Migrations Atomic**
   - One logical change per migration
   - Easier to review and rollback

4. **Document Complex Migrations**
   - Add README.md for complex migrations
   - Explain data transformations
   - Note any manual steps required

5. **Test Rollbacks**
   - Practice rollback procedures on staging
   - Document rollback steps
   - Keep backup before production deployments

## Environment-Specific Notes

### Development
- Migrations apply automatically
- Can reset with `prisma migrate reset`
- Unreleased migrations can be modified

### Staging
- Mirrors production setup
- All migrations must pass tests
- Use for full release rehearsal

### Production
- Migrations are release-critical
- Backup before deployment
- Validate after deployment
- Monitor for errors

## Security Considerations

### Row-Level Security (RLS)
Several migrations implement PostgreSQL RLS:
- Ensures tenant data isolation
- Restricts per-user visibility
- Applied at database level

See migration `20260907112910_enable_row_level_security` for policy details.

### Data Privacy
- Soft deletes preserve audit trail
- Sensitive data is logged in AuditLog
- Ensure backups are secured

## Performance Considerations

### Indexes
Migrations create indexes for:
- Foreign key relationships
- Common query filters
- Tenant + entity scoping

Monitor index usage:
```sql
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

### Large Table Operations
For tables with millions of rows:
- Use `CONCURRENTLY` for index creation
- Consider partitioning strategy
- Monitor lock times

## Troubleshooting

### Drift Detected
Database schema differs from Prisma schema:
```bash
npx prisma db pull
```

### Migration Stuck
If a migration hangs:
1. Check for locks: `SELECT * FROM pg_locks;`
2. Kill blocking queries if necessary
3. Retry migration
4. If repeated, contact DevOps

### Checksum Mismatch
Migration file was modified after application:
1. Never modify applied migrations
2. Create a new migration instead
3. Restore file from git if necessary

## Support & References

- [Migration Checklist](../../MIGRATIONS.md)
- [Release Procedures](../../PHASE4_STATUS.md)
- [Prisma Docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate)

## Contact

For migration questions or issues:
- DevOps team: [slack channel]
- Issue tracker: [github link]

---

Last Updated: 2026-09-10  
Maintained by: DevOps & Database Teams
