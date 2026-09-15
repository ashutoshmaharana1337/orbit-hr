import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/auth.constants.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `https://app.example.com/some/path?x=1` -> `https://app.example.com`; null when unparseable. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defense for the cookie session. The auth cookies are SameSite=None in
 * production (web and api live on different origins), so the browser will
 * attach them to a cross-site form post or fetch — the only thing that
 * distinguishes our own frontend from an attacker's page is the `Origin`
 * header, which browsers set on every cross-origin mutation and which
 * scripts cannot forge.
 *
 * For state-changing methods:
 *  - `Origin` (or, failing that, the origin of `Referer`) must equal WEB_ORIGIN.
 *  - A request carrying neither header is not a browser cross-site request,
 *    but it is also not provably ours; accept it only when it authenticates
 *    with an `Authorization: Bearer` header (API tooling) rather than a
 *    session cookie.
 *
 * Skipped under NODE_ENV=test, where supertest drives cookie sessions with
 * no Origin header (same carve-out the throttler makes).
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (!MUTATING_METHODS.has(req.method.toUpperCase()) || process.env.NODE_ENV === 'test') {
      return next();
    }

    const expected = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const origin = (req.headers.origin as string | undefined) ?? originOf(req.headers.referer);

    if (origin) {
      if (origin !== expected) throw new ForbiddenException('Cross-origin request rejected');
      return next();
    }

    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies ?? {};
    const hasCookieSession = Boolean(cookies[ACCESS_TOKEN_COOKIE] || cookies[REFRESH_TOKEN_COOKIE]);
    const hasBearer = /^Bearer\s+\S+/i.test(req.headers.authorization ?? '');
    if (hasCookieSession && !hasBearer) {
      throw new ForbiddenException('Missing Origin header on cookie-authenticated request');
    }

    next();
  }
}
