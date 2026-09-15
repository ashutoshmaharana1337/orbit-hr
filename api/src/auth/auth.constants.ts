import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const isProd = process.env.NODE_ENV === 'production';

// SameSite=Lax is enough (and required for plain-http localhost dev) when
// web and api share a site. Production deploys web and api on different
// origins, which needs SameSite=None + Secure. None carries no CSRF defense
// of its own: the CSRF protection is OriginCheckMiddleware
// (common/origin-check.middleware.ts), which rejects state-changing requests
// whose Origin/Referer is not WEB_ORIGIN — keep both in sync.
export function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  };
}
