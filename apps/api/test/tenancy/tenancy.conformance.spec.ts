import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from '../utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers, seedSecondCompany } from '../utils/fixtures';

/**
 * Tenancy conformance suite (ROADMAP.md §9.1, D14 layer 3). This is a required CI gate:
 * every tenant-scoped endpoint must be exercised here against another company's token,
 * no token, and an insufficient role, asserting 404 for cross-tenant access (never 403 —
 * 403 would confirm the resource exists in another tenant).
 *
 * Only host resolution and auth exist as of Phase 1. Each domain module added in Phase 2
 * must add its own cases here before it can be considered done (README.md — "adding an
 * endpoint without covering it fails the build").
 */
describe('Tenancy conformance', () => {
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

  it('returns 404 for a hostname with no matching company domain', async () => {
    await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Tenant-Host', 'unknown-company.example.com')
      .expect(404);
  });

  it('resolves a verified company domain to its tenant', async () => {
    const { company } = await seedCompanyWithUsers(prisma);
    const domain = await prisma.companyDomain.findFirstOrThrow({
      where: { companyId: company.id },
    });

    await request(app.getHttpServer())
      .get('/healthz')
      .set('X-Tenant-Host', domain.hostname)
      .expect(200);
  });

  it("does not let company A's admin token read company B's user record via /auth/me", async () => {
    const { admin: adminA } = await seedCompanyWithUsers(prisma);
    await seedSecondCompany(prisma);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', 'admin.tubus.example')
      .send({ email: adminA.email, password: FIXTURE_PASSWORD });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Tenant-Host', 'admin.tubus.example')
      .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
      .expect(200);

    // /auth/me only ever returns the token's own subject — there is no id parameter an
    // attacker could substitute, so cross-tenant leakage here is structurally impossible.
    // This case documents that invariant rather than probing a parameter that doesn't exist.
    expect(res.body.companyId).toBe(adminA.companyId);
  });

  /**
   * Phase 2 domain CRUD (buses/routes/variants/stops/schedules). Each entry names a
   * factory that creates one row in company A and the `GET` path to fetch it by id —
   * every one must 404 for company B's admin, never 403.
   */
  it("returns 404 (not 403) for every Phase 2 resource when fetched with another company's token", async () => {
    const companyA = await seedCompanyWithUsers(prisma);
    const companyB = await seedSecondCompany(prisma);
    const tokenB = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', 'admin.tubus.example')
      .send({ email: companyB.admin.email, password: FIXTURE_PASSWORD })
      .then((res) => res.body.tokens.accessToken);

    const bus = await prisma.bus.create({
      data: { companyId: companyA.company.id, label: 'Bus 1' },
    });
    const route = await prisma.route.create({
      data: {
        companyId: companyA.company.id,
        name: 'R',
        originLabel: 'A',
        destinationLabel: 'B',
        publicSlug: 'conformance-route',
      },
    });
    const variant = await prisma.routeVariant.create({
      data: {
        companyId: companyA.company.id,
        routeId: route.id,
        name: 'V',
        direction: 'OUTBOUND',
        headsign: 'H',
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    });
    const stop = await prisma.stop.create({
      data: { companyId: companyA.company.id, name: 'S', latitude: 1, longitude: 1 },
    });
    const schedule = await prisma.schedule.create({
      data: {
        companyId: companyA.company.id,
        routeVariantId: variant.id,
        departureTime: new Date('1970-01-01T06:00:00Z'),
        daysOfWeek: [1],
      },
    });

    const paths = [
      `/buses/${bus.id}`,
      `/drivers/${companyA.driver.id}`,
      `/routes/${route.id}`,
      `/variants/${variant.id}`,
      `/stops/${stop.id}`,
    ];

    for (const path of paths) {
      await request(app.getHttpServer())
        .get(path)
        .set('X-Tenant-Host', 'admin.tubus.example')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    }

    // Schedules have no single-resource GET; PATCH is the only owner-checked mutation.
    await request(app.getHttpServer())
      .patch(`/schedules/${schedule.id}`)
      .set('X-Tenant-Host', 'admin.tubus.example')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ active: false })
      .expect(404);
  });
});
