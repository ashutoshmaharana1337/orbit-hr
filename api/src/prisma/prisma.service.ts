import { HttpException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { tenantContext } from './tenant-context.js';

/**
 * Every model accessor here is a getter that resolves, via AsyncLocalStorage,
 * to the current request's transaction-bound client when one is active
 * (set up by TenantTransactionInterceptor, which also sets the
 * `app.current_tenant_id` / `app.bypass_rls` session variables Postgres RLS
 * policies check) — falling back to the raw connection otherwise. No
 * existing `this.prisma.employee.findMany()`-style call site needs to
 * change: they all keep working, now scoped by whichever connection is
 * active for the current async context.
 *
 * `raw` and `startRequestTransaction` are the only ways to reach the
 * unscoped connection directly — used solely by
 * TenantTransactionInterceptor to establish the per-request transaction in
 * the first place, and by tests that need to seed fixtures under an
 * explicit tenant context outside a real HTTP request.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly raw = new PrismaClient();

  async onModuleInit() {
    await this.raw.$connect();
  }

  async onModuleDestroy() {
    await this.raw.$disconnect();
  }

  private get active(): PrismaClient | Prisma.TransactionClient {
    return tenantContext.getStore()?.tx ?? this.raw;
  }

  get tenant() {
    return this.active.tenant;
  }
  get user() {
    return this.active.user;
  }
  get employee() {
    return this.active.employee;
  }
  get attendanceRecord() {
    return this.active.attendanceRecord;
  }
  get leaveRequest() {
    return this.active.leaveRequest;
  }
  get leaveBalance() {
    return this.active.leaveBalance;
  }
  get refreshToken() {
    return this.active.refreshToken;
  }
  get passwordSetToken() {
    return this.active.passwordSetToken;
  }

  $executeRaw(query: TemplateStringsArray, ...values: unknown[]) {
    return this.active.$executeRaw(query, ...values);
  }

  /**
   * Runs `fn` inside a fresh transaction on the raw (unscoped) connection,
   * with the RLS session variables set for that transaction's lifetime, and
   * makes that transaction the active client for the duration of `fn` via
   * AsyncLocalStorage. This is the one place a real transaction is opened —
   * everywhere else just reads `this.active`.
   *
   * A deliberate business rejection (an `HttpException` — 401/403/404/409/
   * etc.) does NOT roll back writes `fn` already made before throwing it:
   * e.g. refresh-token replay detection revokes the whole session family
   * and *then* throws Unauthorized — that revocation must survive the
   * request being rejected, not vanish with it. Only a genuinely
   * unexpected error (a real bug, a constraint violation) rolls back.
   */
  async runInTenantContext<T>(
    options: { tenantId: string | null; bypassRls?: boolean },
    fn: () => Promise<T>,
  ): Promise<T> {
    let rejection: HttpException | undefined;

    const result = await this.raw.$transaction(async (tx) => {
      if (options.bypassRls) {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      }
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${options.tenantId}, true)`;

      try {
        return await tenantContext.run({ tx }, fn);
      } catch (err) {
        if (err instanceof HttpException) {
          rejection = err;
          return undefined;
        }
        throw err;
      }
    });

    if (rejection) throw rejection;
    return result as T;
  }
}
