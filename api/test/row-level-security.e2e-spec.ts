import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Every other e2e suite proves the *application* scopes its own queries by
// tenantId. This suite proves the database itself refuses cross-tenant
// access even when application code doesn't — the entire point of adding
// row-level security as a backstop, not a replacement, for those checks.
describe('Postgres row-level security (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ companyName: 'RLS Co', fullName: 'RLS Admin', email, password: 'password123' })
      .expect(201);
    return { tenantId: res.body.tenant.id as string, employeeId: res.body.employee.id as string };
  }

  it("refuses to return another tenant's rows even when the query has no WHERE filter at all", async () => {
    const tenantA = await registerTenant(`rls-a-${Date.now()}@example.com`);
    const tenantB = await registerTenant(`rls-b-${Date.now()}@example.com`);

    // A raw, unfiltered findMany — exactly the query a future change might
    // accidentally ship by forgetting a tenantId clause. Without RLS this
    // would return both tenants' employees.
    const asTenantB = await prisma.runInTenantContext({ tenantId: tenantB.tenantId }, () =>
      prisma.employee.findMany(),
    );

    expect(asTenantB.map((e) => e.id)).toEqual([tenantB.employeeId]);
    expect(asTenantB.some((e) => e.id === tenantA.employeeId)).toBe(false);
  });

  it('refuses to update a row belonging to a different tenant, even addressed by its exact id', async () => {
    const tenantA = await registerTenant(`rls-update-a-${Date.now()}@example.com`);
    const tenantB = await registerTenant(`rls-update-b-${Date.now()}@example.com`);

    await expect(
      prisma.runInTenantContext({ tenantId: tenantB.tenantId }, () =>
        prisma.employee.update({ where: { id: tenantA.employeeId }, data: { name: 'Hacked' } }),
      ),
    ).rejects.toThrow();

    const stillIntact = await prisma.runInTenantContext({ tenantId: tenantA.tenantId }, () =>
      prisma.employee.findUniqueOrThrow({ where: { id: tenantA.employeeId } }),
    );
    expect(stillIntact.name).not.toBe('Hacked');
  });

  it('returns nothing at all when no tenant context is set (fail closed, not fail open)', async () => {
    await registerTenant(`rls-none-${Date.now()}@example.com`);
    const rows = await prisma.raw.employee.findMany();
    expect(rows).toHaveLength(0);
  });
});
