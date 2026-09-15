-- AuditLog was added after the RLS baseline (20260907112910) and never got a
-- policy of its own. It carries a tenantId and is only ever read or written
-- for the current tenant, so apply the same strict both-ways policy as
-- Employee/Department. Grants to orbit_app already flow from the ALTER
-- DEFAULT PRIVILEGES in the baseline migration.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
