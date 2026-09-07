import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

function extractCookie(setCookieHeaders: string[], name: string): string {
  const header = setCookieHeaders.find((c) => c.startsWith(`${name}=`));
  if (!header) throw new Error(`No Set-Cookie header found for ${name}`);
  return header.split(';', 1)[0];
}

describe('Cookie-based session (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in via httpOnly cookies, refreshes, and revokes on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `cookie-${Date.now()}@example.com`;

    const registerRes = await agent
      .post('/api/auth/register')
      .send({ companyName: 'Cookie Co', fullName: 'Cookie Admin', email, password: 'password123' })
      .expect(201);

    expect(registerRes.body.accessToken).toBeUndefined();
    expect(registerRes.body.email).toBe(email);

    const setCookies = registerRes.headers['set-cookie'] as unknown as string[];
    expect(setCookies.some((c) => c.startsWith('access_token=') && /HttpOnly/i.test(c))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('refresh_token=') && /HttpOnly/i.test(c))).toBe(true);

    // The agent's cookie jar carries the session — no Authorization header at all.
    await agent.get('/api/auth/me').expect(200);

    const refreshRes = await agent.post('/api/auth/refresh').expect(200);
    const refreshCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    expect(refreshCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

    await agent.get('/api/auth/me').expect(200);

    await agent.post('/api/auth/logout').expect(200);

    // logout cleared the access cookie and revoked the refresh token server-side.
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/refresh').expect(401);
  });

  it('rejects replay of a rotated-out refresh token', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `replay-${Date.now()}@example.com`;

    const registerRes = await agent
      .post('/api/auth/register')
      .send({ companyName: 'Replay Co', fullName: 'Replay Admin', email, password: 'password123' })
      .expect(201);

    const originalRefreshCookie = extractCookie(registerRes.headers['set-cookie'] as unknown as string[], 'refresh_token');

    await agent.post('/api/auth/refresh').expect(200);

    // Replaying the now-rotated-out refresh token must fail...
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', [originalRefreshCookie])
      .expect(401);

    // ...and the reuse should have burned the whole session, including the
    // legitimate rotated token the agent is now holding.
    await agent.post('/api/auth/refresh').expect(401);
  });
});
