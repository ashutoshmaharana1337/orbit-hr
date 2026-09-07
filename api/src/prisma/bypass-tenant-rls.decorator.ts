import { SetMetadata } from '@nestjs/common';

export const BYPASS_TENANT_RLS_KEY = 'bypassTenantRls';

/**
 * Marks a route as needing to look up rows across tenants — e.g. resolving
 * a login/refresh/invite/reset by email or token hash before any tenant is
 * known. Widens SELECT/UPDATE/DELETE visibility on the specific tables
 * whose RLS policies check `app.bypass_rls` (User, RefreshToken,
 * PasswordSetToken — see the RLS migration); every other table, and every
 * table's WITH CHECK (what a write is allowed to set), stays strictly
 * tenant-scoped regardless of this flag.
 */
export const BypassTenantRls = () => SetMetadata(BYPASS_TENANT_RLS_KEY, true);
