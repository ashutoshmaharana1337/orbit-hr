-- Row-level security: a database-enforced backstop for tenant isolation,
-- independent of every application-layer `tenantId` filter this codebase
-- already applies. If a future query ever forgets one, the database
-- itself refuses the row instead of leaking it.
--
-- This requires a Postgres role that is NOT a superuser and does NOT have
-- BYPASSRLS — both the table owner and any superuser bypass RLS entirely
-- regardless of policies, which would otherwise make everything below a
-- no-op. The app's runtime DATABASE_URL must point at this role; only
-- `prisma migrate`/`db` commands (via directUrl) use the privileged role
-- that owns the schema.
--
-- Session variables the policies below check (set once per request by
-- TenantTransactionInterceptor, see api/src/prisma/):
--   app.current_tenant_id — the authenticated request's tenant, or unset
--                            for a request that hasn't resolved one yet.
--   app.bypass_rls         — 'on' only for the handful of routes that must
--                            look up a row *before* a tenant is known
--                            (login, register, refresh, logout,
--                            forgot/reset-password, invite's email check).
--                            Only ever widens read visibility on the three
--                            tables below whose policies reference it —
--                            never affects WITH CHECK on Tenant/User/
--                            Employee/AttendanceRecord/LeaveRequest, so a
--                            write can never land under the wrong tenant
--                            no matter which flag is set.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_app') THEN
    CREATE ROLE orbit_app WITH LOGIN PASSWORD 'orbit_app_dev_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO orbit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orbit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orbit_app;

-- Tenant: anyone can create one (registration, before any tenant context
-- exists), but can only see/modify their own.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant"
  USING (id = current_setting('app.current_tenant_id', true))
  WITH CHECK (true);

-- User: email is looked up across tenants at login/register/forgot-password
-- time (that's the whole point — the caller doesn't know their tenant
-- yet), so reads can be widened by the bypass flag. Writes can't: a new or
-- updated User row must always declare the real, current tenant.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User"
  USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- Employee, AttendanceRecord, LeaveRequest: always strictly tenant-scoped,
-- both ways. Nothing in this app has a legitimate reason to read or write
-- across tenants on these tables.
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Employee"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AttendanceRecord"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE "LeaveRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveRequest"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- LeaveBalance has no tenantId column of its own — scope it through its
-- owning Employee. (Employee's own RLS policy applies to this subquery
-- too, so the tenant check is effectively enforced twice; harmless.)
ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LeaveBalance"
  USING (EXISTS (
    SELECT 1 FROM "Employee" e
    WHERE e.id = "LeaveBalance"."employeeId" AND e."tenantId" = current_setting('app.current_tenant_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Employee" e
    WHERE e.id = "LeaveBalance"."employeeId" AND e."tenantId" = current_setting('app.current_tenant_id', true)
  ));

-- RefreshToken and PasswordSetToken: looked up by their own unguessable,
-- cryptographically random hash *before* any tenant is known (that's the
-- entire point of a refresh/reset token) — bypass legitimately applies to
-- both USING and WITH CHECK here, unlike every table above. There is no
-- tenantId value on these rows for a write to get wrong: revoking or
-- creating one is only ever gated on "does the referenced user exist",
-- which the application only ever does after resolving that user through
-- its own (tenant-correct) logic.
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RefreshToken"
  USING (current_setting('app.bypass_rls', true) = 'on' OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "RefreshToken"."userId" AND u."tenantId" = current_setting('app.current_tenant_id', true)
  ))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "RefreshToken"."userId" AND u."tenantId" = current_setting('app.current_tenant_id', true)
  ));

ALTER TABLE "PasswordSetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordSetToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PasswordSetToken"
  USING (current_setting('app.bypass_rls', true) = 'on' OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "PasswordSetToken"."userId" AND u."tenantId" = current_setting('app.current_tenant_id', true)
  ))
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = "PasswordSetToken"."userId" AND u."tenantId" = current_setting('app.current_tenant_id', true)
  ));
