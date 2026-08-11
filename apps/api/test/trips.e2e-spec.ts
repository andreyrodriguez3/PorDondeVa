import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { seedRouteWithVariant } from './utils/route-fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

describe('Trips (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await truncateAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function setup() {
    const { company, admin, driver } = await seedCompanyWithUsers(prisma);
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'Bus 1' } });
    await prisma.driverProfile.update({
      where: { userId: driver.id },
      data: { defaultBusId: bus.id },
    });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);
    const driverToken = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ companyCode: company.slug, username: driver.username, password: FIXTURE_PASSWORD })
      .then((res) => res.body.tokens.accessToken);
    const adminToken = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
    return { company, admin, driver, bus, route, variant, driverToken, adminToken };
  }

  it('starts a trip using the driver default bus and finds it as active', async () => {
    const { variant, driverToken } = await setup();

    const start = await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id })
      .expect(201);
    expect(start.body.status).toBe('ACTIVE');

    const active = await request(app.getHttpServer())
      .get('/driver/trips/active')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    expect(active.body.id).toBe(start.body.id);
  });

  it('rejects starting a second trip on a bus that already has an active trip (409)', async () => {
    const { company, variant, bus, driverToken } = await setup();
    await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id })
      .expect(201);

    // A second driver, same company, explicitly targeting the same bus.
    const passwordHash = (await prisma.user.findFirstOrThrow({ where: { companyId: company.id } }))
      .passwordHash;
    const secondDriver = await prisma.user.create({
      data: {
        companyId: company.id,
        username: 'seconddriver',
        name: 'Second Driver',
        role: 'DRIVER',
        passwordHash,
        driverProfile: { create: { companyId: company.id } },
      },
    });
    const secondToken = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({
        companyCode: company.slug,
        username: secondDriver.username,
        password: FIXTURE_PASSWORD,
      })
      .then((res) => res.body.tokens.accessToken);

    await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ routeVariantId: variant.id, busId: bus.id })
      .expect(409);
  });

  it('lets a driver end their own trip, and an admin end any trip', async () => {
    const { variant, driverToken, adminToken } = await setup();
    const start = await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id });

    await request(app.getHttpServer())
      .post(`/driver/trips/${start.body.id}/end`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    const check = await request(app.getHttpServer())
      .get(`/trips/${start.body.id}`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(check.body.status).toBe('COMPLETED');
  });

  it("returns 404 when a driver tries to end another driver's trip", async () => {
    const { company, variant, driverToken } = await setup();
    const start = await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id });

    const passwordHash = (await prisma.user.findFirstOrThrow({ where: { companyId: company.id } }))
      .passwordHash;
    const otherDriver = await prisma.user.create({
      data: {
        companyId: company.id,
        username: 'otherdriver',
        name: 'Other Driver',
        role: 'DRIVER',
        passwordHash,
        driverProfile: { create: { companyId: company.id } },
      },
    });
    const otherToken = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({
        companyCode: company.slug,
        username: otherDriver.username,
        password: FIXTURE_PASSWORD,
      })
      .then((res) => res.body.tokens.accessToken);

    await request(app.getHttpServer())
      .post(`/driver/trips/${start.body.id}/end`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('lists trips for an admin, filterable by status', async () => {
    const { variant, driverToken, adminToken } = await setup();
    await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id });

    const res = await request(app.getHttpServer())
      .get('/trips?status=ACTIVE')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
  });
});
