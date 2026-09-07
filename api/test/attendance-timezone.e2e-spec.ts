import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Tenant timezone drives attendance business-date and late cutoff (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenantInKolkata(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ companyName: 'Kolkata Co', fullName: 'Kolkata Admin', email, password: 'password123' })
      .expect(201);
    await agent.patch('/api/tenant/settings').send({ timezone: 'Asia/Kolkata', lateCutoffMinutes: 600 }).expect(200);
    return agent;
  }

  it('clocks in as PRESENT just before the tenant-local cutoff', async () => {
    const agent = await registerTenantInKolkata(`ist-present-${Date.now()}@example.com`);

    // 04:15 UTC = 09:45 IST — 15 minutes before the 10:00 cutoff.
    vi.useFakeTimers({ now: new Date('2026-09-07T04:15:00.000Z'), shouldAdvanceTime: true });

    const res = await agent.post('/api/attendance/clock-in').expect(201);
    expect(res.body.status).toBe('PRESENT');
  });

  it('clocks in as LATE just after the tenant-local cutoff', async () => {
    const agent = await registerTenantInKolkata(`ist-late-${Date.now()}@example.com`);

    // 04:45 UTC = 10:15 IST — 15 minutes after the 10:00 cutoff.
    vi.useFakeTimers({ now: new Date('2026-09-07T04:45:00.000Z'), shouldAdvanceTime: true });

    const res = await agent.post('/api/attendance/clock-in').expect(201);
    expect(res.body.status).toBe('LATE');
  });

  it('buckets a clock-in into tenant-local "today", even across the UTC midnight boundary', async () => {
    const agent = await registerTenantInKolkata(`ist-midnight-${Date.now()}@example.com`);

    // 19:15 UTC on the 6th is 00:45 IST on the 7th — already tomorrow in India.
    vi.useFakeTimers({ now: new Date('2026-09-06T19:15:00.000Z'), shouldAdvanceTime: true });

    const clockInRes = await agent.post('/api/attendance/clock-in').expect(201);
    expect(new Date(clockInRes.body.date).toISOString().slice(0, 10)).toBe('2026-09-07');

    const todayRes = await agent.get('/api/attendance/today').expect(200);
    expect(todayRes.body).toHaveLength(1);
  });

  it('rejects an unknown time zone', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({
        companyName: 'Bad TZ Co',
        fullName: 'Admin',
        email: `badtz-${Date.now()}@example.com`,
        password: 'password123',
      })
      .expect(201);

    await agent.patch('/api/tenant/settings').send({ timezone: 'Not/AZone' }).expect(400);
  });

  it('only ADMIN can change tenant settings', async () => {
    const admin = await registerTenantInKolkata(`settings-admin-${Date.now()}@example.com`);
    const meRes = await admin.get('/api/auth/me').expect(200);
    const tenantId = meRes.body.tenant.id as string;

    const employeeUser = await prisma.user.create({
      data: { tenantId, email: `settings-employee-${Date.now()}@example.com`, passwordHash: 'x', role: 'EMPLOYEE' },
    });
    const employeeToken = jwt.sign({
      sub: employeeUser.id,
      tenantId,
      email: employeeUser.email,
      role: 'EMPLOYEE',
    });

    await request(app.getHttpServer())
      .patch('/api/tenant/settings')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ lateCutoffMinutes: 0 })
      .expect(403);

    // Any authenticated role can still read settings.
    await request(app.getHttpServer())
      .get('/api/tenant/settings')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
  });
});
