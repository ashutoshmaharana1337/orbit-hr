import { createHash } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { MailService, type SendMailInput } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function extractToken(text: string): string {
  const match = text.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error(`No token found in mail body: ${text}`);
  return match[1];
}

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

describe('Invite and password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sentEmails: SendMailInput[];

  beforeAll(async () => {
    sentEmails = [];
    const fakeMail: Pick<MailService, 'send'> = {
      send: async (input) => {
        sentEmails.push(input);
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    sentEmails.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerAdmin(email: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/api/auth/register')
      .send({ companyName: 'Invite Co', fullName: 'Invite Admin', email, password: 'password123' })
      .expect(201);
    return { agent, tenantId: res.body.tenant.id as string };
  }

  it('invites an employee, and the invite token activates their account', async () => {
    const admin = await registerAdmin(`invite-admin-${Date.now()}@example.com`);

    const employeeEmail = `new-hire-${Date.now()}@example.com`;
    const employeeRes = await admin.agent
      .post('/api/employees')
      .send({
        name: 'New Hire',
        email: employeeEmail,
        title: 'Engineer',
        department: 'Engineering',
        location: 'Remote',
        joinDate: '2026-01-01',
        phone: '0000000000',
      })
      .expect(201);

    await admin.agent.post(`/api/employees/${employeeRes.body.id}/invite`).expect(201);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe(employeeEmail);
    const token = extractToken(sentEmails[0].text);

    // Can't log in until the invite is accepted.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: employeeEmail, password: 'whatever123' })
      .expect(401);

    const acceptRes = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpassword123' })
      .expect(200);
    expect(acceptRes.body.email).toBe(employeeEmail);

    // Now a normal login works with the password just set.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: employeeEmail, password: 'newpassword123' })
      .expect(200);

    // The token is single-use.
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'anotherpassword' })
      .expect(401);
  });

  it('rejects inviting an employee who already has a login', async () => {
    const admin = await registerAdmin(`invite-admin2-${Date.now()}@example.com`);

    const employeeRes = await admin.agent
      .post('/api/employees')
      .send({
        name: 'Already Has Login',
        email: `dup-${Date.now()}@example.com`,
        title: 'Engineer',
        department: 'Engineering',
        location: 'Remote',
        joinDate: '2026-01-01',
        phone: '0000000000',
      })
      .expect(201);

    await admin.agent.post(`/api/employees/${employeeRes.body.id}/invite`).expect(201);
    await admin.agent.post(`/api/employees/${employeeRes.body.id}/invite`).expect(409);
  });

  it('resets a forgotten password without leaking whether the email exists', async () => {
    const email = `forgot-${Date.now()}@example.com`;
    const admin = await registerAdmin(email);

    const res1 = await request(app.getHttpServer()).post('/api/auth/forgot-password').send({ email }).expect(200);
    expect(res1.body.success).toBe(true);
    expect(sentEmails).toHaveLength(1);

    const res2 = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: `nobody-${Date.now()}@example.com` })
      .expect(200);
    expect(res2.body.success).toBe(true);
    // Identical response either way; no second email was actually sent.
    expect(sentEmails).toHaveLength(1);

    const token = extractToken(sentEmails[0].text);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'brandnewpassword' })
      .expect(200);

    // Resetting the password revoked the session created at registration.
    await admin.agent.post('/api/auth/refresh').expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'brandnewpassword' })
      .expect(200);
  });

  it('rejects an expired reset token', async () => {
    const email = `expired-${Date.now()}@example.com`;
    await registerAdmin(email);

    await request(app.getHttpServer()).post('/api/auth/forgot-password').send({ email }).expect(200);
    const token = extractToken(sentEmails[0].text);

    await prisma.passwordSetToken.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: 'x'.repeat(10) })
      .expect(401);
  });
});
