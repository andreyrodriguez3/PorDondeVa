import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

const LINESTRING = {
  type: 'LineString' as const,
  coordinates: [
    [-84.0833, 9.9333],
    [-84.433, 10.0575],
  ] as [number, number][],
};

describe('Routes, variants, stops, schedules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const { admin } = await seedCompanyWithUsers(prisma);
    token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
  });

  afterEach(async () => {
    await truncateAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ 'X-Tenant-Host': ADMIN_HOST, Authorization: `Bearer ${token}` });

  it('creates a route, a variant on it, and lists both', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({
        name: 'San José → Palmares',
        originLabel: 'San José',
        destinationLabel: 'Palmares',
        publicSlug: 'sj-palmares',
      })
      .expect(201);

    const variant = await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({
        name: 'Vía Grecia',
        direction: 'OUTBOUND',
        headsign: 'Hacia Palmares',
        geometry: LINESTRING,
        isDefault: true,
      })
      .expect(201);

    expect(variant.body.routeId).toBe(route.body.id);

    const list = await request(app.getHttpServer())
      .get(`/routes/${route.body.id}/variants`)
      .set(auth())
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a route slug collision within the company with 409', async () => {
    const create = () =>
      request(app.getHttpServer()).post('/routes').set(auth()).send({
        name: 'A',
        originLabel: 'A',
        destinationLabel: 'B',
        publicSlug: 'dup-slug',
      });

    await create().expect(201);
    await create().expect(409);
  });

  it('rejects a variant geometry that is not a LineString', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({ name: 'R', originLabel: 'A', destinationLabel: 'B', publicSlug: 'r-slug' });

    await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({
        name: 'V',
        direction: 'OUTBOUND',
        headsign: 'H',
        geometry: { type: 'Point', coordinates: [1, 2] },
      })
      .expect(400);
  });

  it('attaches stops to a variant and reorders them, rewriting sequence 1..N', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({ name: 'R', originLabel: 'A', destinationLabel: 'B', publicSlug: 'r2' });
    const variant = await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({ name: 'V', direction: 'OUTBOUND', headsign: 'H', geometry: LINESTRING });

    const stopA = await request(app.getHttpServer())
      .post('/stops')
      .set(auth())
      .send({ name: 'A', latitude: 1, longitude: 1 });
    const stopB = await request(app.getHttpServer())
      .post('/stops')
      .set(auth())
      .send({ name: 'B', latitude: 2, longitude: 2 });

    await request(app.getHttpServer())
      .post(`/variants/${variant.body.id}/stops`)
      .set(auth())
      .send({ stopId: stopA.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/variants/${variant.body.id}/stops`)
      .set(auth())
      .send({ stopId: stopB.body.id })
      .expect(201);

    const ordered = await request(app.getHttpServer())
      .get(`/variants/${variant.body.id}/stops`)
      .set(auth())
      .expect(200);
    expect(ordered.body.map((s: { name: string }) => s.name)).toEqual(['A', 'B']);

    await request(app.getHttpServer())
      .put(`/variants/${variant.body.id}/stops/order`)
      .set(auth())
      .send({ stopIds: [stopB.body.id, stopA.body.id] })
      .expect(200);

    const reordered = await request(app.getHttpServer())
      .get(`/variants/${variant.body.id}/stops`)
      .set(auth())
      .expect(200);
    expect(
      reordered.body.map((s: { name: string; sequence: number }) => [s.name, s.sequence]),
    ).toEqual([
      ['B', 1],
      ['A', 2],
    ]);
  });

  it('rejects a reorder payload that does not match the currently attached stop set', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({ name: 'R', originLabel: 'A', destinationLabel: 'B', publicSlug: 'r3' });
    const variant = await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({ name: 'V', direction: 'OUTBOUND', headsign: 'H', geometry: LINESTRING });

    await request(app.getHttpServer())
      .put(`/variants/${variant.body.id}/stops/order`)
      .set(auth())
      .send({ stopIds: ['00000000-0000-0000-0000-000000000000'] })
      .expect(400);
  });

  it('creates, updates and deletes a schedule on a variant', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({ name: 'R', originLabel: 'A', destinationLabel: 'B', publicSlug: 'r4' });
    const variant = await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({ name: 'V', direction: 'OUTBOUND', headsign: 'H', geometry: LINESTRING });

    const schedule = await request(app.getHttpServer())
      .post(`/variants/${variant.body.id}/schedules`)
      .set(auth())
      .send({ departureTime: '06:30', daysOfWeek: [1, 2, 3, 4, 5] })
      .expect(201);
    expect(schedule.body.departureTime).toBe('06:30');

    await request(app.getHttpServer())
      .patch(`/schedules/${schedule.body.id}`)
      .set(auth())
      .send({ active: false })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/schedules/${schedule.body.id}`)
      .set(auth())
      .expect(200);

    const remaining = await request(app.getHttpServer())
      .get(`/variants/${variant.body.id}/schedules`)
      .set(auth())
      .expect(200);
    expect(remaining.body).toHaveLength(0);
  });

  it('rejects an out-of-range day of week with 400', async () => {
    const route = await request(app.getHttpServer())
      .post('/routes')
      .set(auth())
      .send({ name: 'R', originLabel: 'A', destinationLabel: 'B', publicSlug: 'r5' });
    const variant = await request(app.getHttpServer())
      .post(`/routes/${route.body.id}/variants`)
      .set(auth())
      .send({ name: 'V', direction: 'OUTBOUND', headsign: 'H', geometry: LINESTRING });

    await request(app.getHttpServer())
      .post(`/variants/${variant.body.id}/schedules`)
      .set(auth())
      .send({ departureTime: '06:30', daysOfWeek: [7] })
      .expect(400);
  });
});
