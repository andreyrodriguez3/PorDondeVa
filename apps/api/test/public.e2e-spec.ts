import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { seedRouteWithVariant } from './utils/route-fixtures';
import { ADMIN_HOST } from './utils/auth-helper';

describe('Public passenger API (e2e)', () => {
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

  it("serves a company's public profile by its resolved hostname", async () => {
    const { company } = await seedCompanyWithUsers(prisma);
    const domain = await prisma.companyDomain.findFirstOrThrow({
      where: { companyId: company.id },
    });

    const res = await request(app.getHttpServer())
      .get('/public/company')
      .set('X-Tenant-Host', domain.hostname)
      .expect(200);
    expect(res.body.name).toBe(company.name);
  });

  it('never leaks driver identity in the public route/live payload', async () => {
    const { company, driver } = await seedCompanyWithUsers(prisma);
    const domain = await prisma.companyDomain.findFirstOrThrow({
      where: { companyId: company.id },
    });
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'Bus 1' } });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);

    const driverToken = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ companyCode: company.slug, username: driver.username, password: FIXTURE_PASSWORD })
      .then((res) => res.body.tokens.accessToken);

    const trip = await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id, busId: bus.id })
      .then((res) => res.body);

    await request(app.getHttpServer())
      .post(`/driver/trips/${trip.id}/locations`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        points: [
          {
            clientPointId: randomUUID(),
            lat: 9.9,
            lng: -84.0,
            deviceTimestamp: new Date().toISOString(),
          },
        ],
      });

    const res = await request(app.getHttpServer())
      .get(`/public/routes/${route.publicSlug}/live`)
      .set('X-Tenant-Host', domain.hostname)
      .expect(200);

    expect(res.body.buses).toHaveLength(1);
    const payload = JSON.stringify(res.body.buses[0]);
    expect(payload).not.toContain(driver.name);
    expect(payload).not.toContain(driver.id);
    expect(res.body.buses[0].busLabel).toBe('Bus 1');
  });

  it('returns route details with ordered stops and geometry', async () => {
    const { company } = await seedCompanyWithUsers(prisma);
    const domain = await prisma.companyDomain.findFirstOrThrow({
      where: { companyId: company.id },
    });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);
    const stopA = await prisma.stop.create({
      data: { companyId: company.id, name: 'A', latitude: 1, longitude: 1 },
    });
    const stopB = await prisma.stop.create({
      data: { companyId: company.id, name: 'B', latitude: 2, longitude: 2 },
    });
    await prisma.routeVariantStop.create({
      data: { companyId: company.id, routeVariantId: variant.id, stopId: stopA.id, sequence: 1 },
    });
    await prisma.routeVariantStop.create({
      data: { companyId: company.id, routeVariantId: variant.id, stopId: stopB.id, sequence: 2 },
    });

    const res = await request(app.getHttpServer())
      .get(`/public/routes/${route.publicSlug}`)
      .set('X-Tenant-Host', domain.hostname)
      .expect(200);

    expect(res.body.variants[0].stops.map((s: { name: string }) => s.name)).toEqual(['A', 'B']);
  });

  it('returns 404 for an unknown hostname on any public route', async () => {
    await request(app.getHttpServer())
      .get('/public/company')
      .set('X-Tenant-Host', 'not-a-real-company.example.com')
      .expect(404);
  });

  it("returns a company's routes with zero active buses when none are running", async () => {
    const { company } = await seedCompanyWithUsers(prisma);
    const domain = await prisma.companyDomain.findFirstOrThrow({
      where: { companyId: company.id },
    });
    await seedRouteWithVariant(prisma, company.id);

    const res = await request(app.getHttpServer())
      .get('/public/routes')
      .set('X-Tenant-Host', domain.hostname)
      .expect(200);
    expect(res.body[0].activeBusCount).toBe(0);
  });

  describe('domains/allowed (Caddy ask endpoint)', () => {
    it('returns 200 for a verified hostname', async () => {
      const { company } = await seedCompanyWithUsers(prisma);
      const domain = await prisma.companyDomain.findFirstOrThrow({
        where: { companyId: company.id },
      });

      await request(app.getHttpServer())
        .get(`/public/domains/allowed?domain=${domain.hostname}`)
        .expect(200);
    });

    it('returns 404 for an unverified or unknown hostname', async () => {
      await request(app.getHttpServer())
        .get('/public/domains/allowed?domain=not-registered.example.com')
        .expect(404);
    });
  });
});
