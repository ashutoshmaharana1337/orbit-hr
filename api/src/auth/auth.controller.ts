import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { JwtPayload } from './auth.types.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, baseCookieOptions } from './auth.constants.js';
import { BypassTenantRls } from '../prisma/bypass-tenant-rls.decorator.js';

// Credential-guessing and tenant-spam endpoints get a much tighter limit
// than the app-wide default.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @BypassTenantRls()
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { profile, accessToken, refreshToken, refreshTokenExpiresAt } = await this.auth.register(dto);
    setAuthCookies(res, accessToken, refreshToken, refreshTokenExpiresAt);
    return profile;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @BypassTenantRls()
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { profile, accessToken, refreshToken, refreshTokenExpiresAt } = await this.auth.login(dto);
    setAuthCookies(res, accessToken, refreshToken, refreshTokenExpiresAt);
    return profile;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @BypassTenantRls()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { profile, accessToken, refreshToken, refreshTokenExpiresAt } = await this.auth.refresh(
      req.cookies?.[REFRESH_TOKEN_COOKIE],
    );
    setAuthCookies(res, accessToken, refreshToken, refreshTokenExpiresAt);
    return profile;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @BypassTenantRls()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth' });
    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @BypassTenantRls()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @BypassTenantRls()
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const { profile, accessToken, refreshToken, refreshTokenExpiresAt } = await this.auth.resetPassword(
      dto.token,
      dto.password,
    );
    setAuthCookies(res, accessToken, refreshToken, refreshTokenExpiresAt);
    return profile;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user);
  }
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshTokenExpiresAt: Date) {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...baseCookieOptions(), path: '/' });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: '/api/auth',
    expires: refreshTokenExpiresAt,
  });
}
