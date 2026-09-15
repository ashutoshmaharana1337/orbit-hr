import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload } from './auth.types.js';
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js';
import { getRequestContext } from '../common/request-context.js';

function fromCookie(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Cookie first (browser sessions); Bearer header as a fallback for
      // API tooling and tests that don't carry a cookie jar.
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    // Middleware set up the request's AsyncLocalStorage store before any
    // user was known; now that the token is verified, tag the store so every
    // later log line in this request carries tenant/user fields.
    const ctx = getRequestContext();
    if (ctx) {
      ctx.tenantId = payload.tenantId;
      ctx.userId = payload.sub;
      ctx.userRole = payload.role;
    }
    return payload;
  }
}
