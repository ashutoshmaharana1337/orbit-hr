import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const isProd = process.env.NODE_ENV === 'production';

// SameSite=Lax is enough (and required for plain-http localhost dev) when
// web and api share a site. A production deployment across unrelated
// domains needs SameSite=None + Secure, which also means adding real CSRF
// protection (e.g. a double-submit header) since None carries no CSRF
// defense on its own — track that alongside picking the production domains.
export function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  };
}
