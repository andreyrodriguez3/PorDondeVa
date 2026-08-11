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
});
