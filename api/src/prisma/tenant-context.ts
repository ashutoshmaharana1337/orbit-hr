import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

export type TenantStore = {
  tx: Prisma.TransactionClient;
};

// Carries the current request's transaction-bound Prisma client across
// the async call stack, so every existing `this.prisma.foo.bar()` call
// site transparently runs against the same connection that the request's
// RLS session variable was set on — no service code needs to change.
export const tenantContext = new AsyncLocalStorage<TenantStore>();
