import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { JwtPayload } from '../src/auth/auth.types.js';

describe('Tenant isolation and role visibility (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(payload: JwtPayload) {
    return jwt.sign(payload);
  }

  async function registerTenant(companyName: string, email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ companyName, fullName: 'Admin User', email, password: 'password123' })
      .expect(201);
    const accessToken = res.body.accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return {
      accessToken,
      tenantId: me.body.tenant.id as string,
      adminEmployeeId: me.body.employee.id as string,
    };
  }

  it('blocks a cross-tenant attendance upsert by employeeId', async () => {
    const tenantA = await registerTenant('Tenant A Co', `admin-a-${Date.now()}@example.com`);
    const tenantB = await registerTenant('Tenant B Co', `admin-b-${Date.now()}@example.com`);

    await request(app.getHttpServer())
      .post('/api/attendance')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .send({ employeeId: tenantA.adminEmployeeId, date: '2026-09-01', status: 'PRESENT' })
      .expect(404);
  });

  it('blocks a cross-tenant managerId on employee create', async () => {
    const tenantA = await registerTenant('Tenant A Co', `admin-a2-${Date.now()}@example.com`);
    const tenantB = await registerTenant('Tenant B Co', `admin-b2-${Date.now()}@example.com`);

    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${tenantB.accessToken}`)
      .send({
        name: 'New Hire',
        email: `hire-${Date.now()}@example.com`,
        title: 'Engineer',
        department: 'Engineering',
        location: 'Remote',
        managerId: tenantA.adminEmployeeId,
        joinDate: '2026-01-01',
        phone: '0000000000',
      })
      .expect(404);
  });

  it('does not let an EMPLOYEE read a colleague\'s leave reason', async () => {
    const tenant = await registerTenant('Solo Co', `admin-c-${Date.now()}@example.com`);

    const colleague = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({
        name: 'Colleague',
        email: `colleague-${Date.now()}@example.com`,
        title: 'Engineer',
        department: 'Engineering',
        location: 'Remote',
        joinDate: '2026-01-01',
        phone: '1111111111',
      })
      .expect(201);

    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.tenantId,
        employeeId: colleague.body.id,
        type: 'ANNUAL',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-02'),
        days: 2,
        reason: 'Private medical reason',
      },
    });

    const bystanderUser = await prisma.user.create({
      data: {
        tenantId: tenant.tenantId,
        email: `bystander-${Date.now()}@example.com`,
        passwordHash: 'x',
        role: 'EMPLOYEE',
      },
    });
    const bystanderEmployee = await prisma.employee.create({
      data: {
        tenantId: tenant.tenantId,
        userId: bystanderUser.id,
        name: 'Bystander',
        email: bystanderUser.email,
        title: 'Intern',
        department: 'Engineering',
        location: 'Remote',
        joinDate: new Date(),
        phone: '',
        leaveBalance: { create: {} },
      },
    });
    const bystanderToken = tokenFor({
      sub: bystanderUser.id,
      tenantId: tenant.tenantId,
      email: bystanderUser.email,
      role: 'EMPLOYEE',
    });

    const res = await request(app.getHttpServer())
      .get('/api/leave')
      .set('Authorization', `Bearer ${bystanderToken}`)
      .expect(200);

    expect(
      (res.body as Array<{ employeeId: string }>).every((r) => r.employeeId === bystanderEmployee.id),
    ).toBe(true);
  });

  it('rejects self-approval of a leave request', async () => {
    const tenant = await registerTenant('Self Approve Co', `admin-d-${Date.now()}@example.com`);

    const leave = await request(app.getHttpServer())
      .post('/api/leave')
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .send({ type: 'ANNUAL', startDate: '2026-11-02', endDate: '2026-11-02', reason: 'Personal' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/leave/${leave.body.id}/approve`)
      .set('Authorization', `Bearer ${tenant.accessToken}`)
      .expect(403);
  });
});
