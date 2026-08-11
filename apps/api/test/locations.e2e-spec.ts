import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { seedRouteWithVariant } from './utils/route-fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

describe('Location ingest (e2e)', () => {
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

  async function setupActiveTrip() {
    const { company, admin, driver } = await seedCompanyWithUsers(prisma);
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'Bus 1' } });
    await prisma.driverProfile.update({
      where: { userId: driver.id },
      data: { defaultBusId: bus.id },
    });
    const { variant } = await seedRouteWithVariant(prisma, company.id);
    const driverToken = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ companyCode: company.slug, username: driver.username, password: FIXTURE_PASSWORD })
      .then((res) => res.body.tokens.accessToken);
    const adminToken = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
    const trip = await request(app.getHttpServer())
      .post('/driver/trips')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeVariantId: variant.id })
      .then((res) => res.body);
    return { company, driver, driverToken, adminToken, trip };
  }

  const send = (app: INestApplication, tripId: string, token: string, points: unknown[]) =>
    request(app.getHttpServer())
      .post(`/driver/trips/${tripId}/locations`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${token}`)
      .send({ points });

  it('accepts a point and advances the live state', async () => {
    const { trip, driverToken, adminToken } = await setupActiveTrip();
    const res = await send(app, trip.id, driverToken, [
      {
        clientPointId: randomUUID(),
        lat: 9.9,
        lng: -84.0,
        deviceTimestamp: new Date().toISOString(),
      },
    ]).expect(201);

    expect(res.body.results[0].outcome).toBe('accepted');

    const fleet = await request(app.getHttpServer())
      .get('/live/fleet')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(fleet.body).toHaveLength(1);
    expect(fleet.body[0].tripId).toBe(trip.id);
  });

  it('is idempotent: resending the same batch reports duplicate and does not error', async () => {
    const { trip, driverToken } = await setupActiveTrip();
    const point = {
      clientPointId: randomUUID(),
      lat: 9.9,
      lng: -84.0,
      deviceTimestamp: new Date().toISOString(),
    };

    const first = await send(app, trip.id, driverToken, [point]).expect(201);
    expect(first.body.results[0].outcome).toBe('accepted');

    const second = await send(app, trip.id, driverToken, [point]).expect(201);
    expect(second.body.results[0].outcome).toBe('duplicate');
  });

  it('never lets an out-of-order offline flush drag the live position backwards (D11)', async () => {
    const { trip, driverToken, adminToken } = await setupActiveTrip();
    const now = Date.now();
    const newer = {
      clientPointId: randomUUID(),
      lat: 10.0,
      lng: -84.0,
      deviceTimestamp: new Date(now).toISOString(),
    };
    const older = {
      clientPointId: randomUUID(),
      lat: 5.0,
      lng: -80.0,
      deviceTimestamp: new Date(now - 10 * 60_000).toISOString(),
    };

    await send(app, trip.id, driverToken, [newer]).expect(201);
    await send(app, trip.id, driverToken, [older]).expect(201);

    const fleet = await request(app.getHttpServer())
      .get('/live/fleet')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    // The marker must still show the newer fix, not the older one that arrived after it.
    expect(fleet.body[0].lat).toBe(10.0);
  });

  it('accepts a batch of old points arriving after an outage without moving the marker', async () => {
    const { trip, driverToken, adminToken } = await setupActiveTrip();
    const now = Date.now();
    const fresh = {
      clientPointId: randomUUID(),
      lat: 11.0,
      lng: -84.0,
      deviceTimestamp: new Date(now).toISOString(),
    };
    await send(app, trip.id, driverToken, [fresh]).expect(201);

    // Within the 5-minute pre-trip tolerance (D12) but older than the fresh fix above —
    // a realistic short outage, not a clock-skew case.
    const staleBatch = Array.from({ length: 50 }, (_, i) => ({
      clientPointId: randomUUID(),
      lat: 1 + i * 0.01,
      lng: -80,
      deviceTimestamp: new Date(now - (60 + i) * 1000).toISOString(),
    }));
    const res = await send(app, trip.id, driverToken, staleBatch).expect(201);
    expect(res.body.results.every((r: { outcome: string }) => r.outcome === 'accepted')).toBe(true);

    const fleet = await request(app.getHttpServer())
      .get('/live/fleet')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(fleet.body[0].lat).toBe(11.0);
  });

  it('rejects a point with a device timestamp too far in the future and counts it', async () => {
    const { trip, driverToken, adminToken } = await setupActiveTrip();
    const future = {
      clientPointId: randomUUID(),
      lat: 9.9,
      lng: -84.0,
      deviceTimestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    const res = await send(app, trip.id, driverToken, [future]).expect(201);
    expect(res.body.results[0].outcome).toBe('rejected');

    const detail = await request(app.getHttpServer())
      .get(`/trips/${trip.id}`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.rejectedPointCount).toBe(1);
  });

  it("returns 403 when a driver posts to another driver's trip", async () => {
    const { company, trip } = await setupActiveTrip();
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

    await send(app, trip.id, otherToken, [
      { clientPointId: randomUUID(), lat: 1, lng: 1, deviceTimestamp: new Date().toISOString() },
    ]).expect(403);
  });

  it('returns 403 when posting to a trip that has already ended', async () => {
    const { trip, driverToken } = await setupActiveTrip();
    await request(app.getHttpServer())
      .post(`/driver/trips/${trip.id}/end`)
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    await send(app, trip.id, driverToken, [
      { clientPointId: randomUUID(), lat: 1, lng: 1, deviceTimestamp: new Date().toISOString() },
    ]).expect(403);
  });
});
