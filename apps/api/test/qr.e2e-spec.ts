import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { seedRouteWithVariant } from './utils/route-fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

describe('QR codes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let companyId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    const { admin, company } = await seedCompanyWithUsers(prisma);
    companyId = company.id;
    token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
  });

  afterEach(async () => {
    await truncateAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ 'X-Tenant-Host': ADMIN_HOST, Authorization: `Bearer ${token}` });

  it('generates a PNG QR code for the company landing page', async () => {
    const res = await request(app.getHttpServer()).get('/qr/company').set(auth()).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('generates a PNG QR code for a specific route', async () => {
    const { route } = await seedRouteWithVariant(prisma, companyId);

    const res = await request(app.getHttpServer())
      .get(`/qr/route/${route.id}`)
      .set(auth())
      .expect(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});
