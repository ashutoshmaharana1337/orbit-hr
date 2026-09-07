-- Postgres RLS enforces the SELECT (USING) policy on the row an
-- `INSERT ... RETURNING` hands back, not just WITH CHECK on the write
-- itself — and Prisma's `.create()` always uses RETURNING. A brand new
-- tenant's id can never already equal `app.current_tenant_id` (that's
-- the whole chicken-and-egg register() has to solve), so the original
-- policy made every registration's own INSERT...RETURNING fail, even
-- though the INSERT itself was allowed by WITH CHECK (true).
--
-- register() already sets app.bypass_rls='on' for its entire request
-- (see @BypassTenantRls() in AuthController) specifically to read across
-- tenants before one is known — extend that same flag to Tenant's own
-- read visibility so creating one can also see the row it just made.
DROP POLICY tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING (current_setting('app.bypass_rls', true) = 'on' OR id = current_setting('app.current_tenant_id', true))
  WITH CHECK (true);
