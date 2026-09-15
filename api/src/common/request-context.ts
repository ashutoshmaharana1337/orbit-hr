/**
 * Request context storage using AsyncLocalStorage
 *
 * Stores request-scoped data (requestId, tenantId, userId, userRole)
 * that can be accessed from anywhere in the request context without
 * passing it through function parameters.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  requestId: string;
  tenantId?: string;
  userId?: string;
  userRole?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function setRequestContext(context: RequestContext): RequestContext {
  return context;
}

export function generateRequestId(): string {
  return randomUUID();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}
