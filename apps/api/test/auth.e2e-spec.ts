import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';

const ADMIN_HOST = 'admin.tubus.example';

describe('Auth (e2e)', () => {
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

  it('logs a web user in with email + password and returns tokens', async () => {
    const { admin } = await seedCompanyWithUsers(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ email: admin.email, password: FIXTURE_PASSWORD })
      .expect(201);

    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('COMPANY_ADMIN');
  });

  it('rejects an invalid password with 401', async () => {
    const { admin } = await seedCompanyWithUsers(prisma);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ email: admin.email, password: 'wrong-password' })
      .expect(401);
  });

  it('logs a driver in with company code + username (D20)', async () => {
    const { company, driver } = await seedCompanyWithUsers(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/driver/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ companyCode: company.slug, username: driver.username, password: FIXTURE_PASSWORD })
      .expect(201);

    expect(res.body.user.role).toBe('DRIVER');
  });

  it('returns the current user from /auth/me with a valid access token', async () => {
    const { admin } = await seedCompanyWithUsers(prisma);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ email: admin.email, password: FIXTURE_PASSWORD });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('X-Tenant-Host', ADMIN_HOST)
      .set('Authorization', `Bearer ${login.body.tokens.accessToken}`)
      .expect(200);

    expect(res.body.id).toBe(admin.id);
  });

  it('rejects /auth/me with no token', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('X-Tenant-Host', ADMIN_HOST).expect(401);
  });

  it('rotates the refresh token and rejects reuse of the old one (theft detection, D9)', async () => {
    const { admin } = await seedCompanyWithUsers(prisma);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ email: admin.email, password: FIXTURE_PASSWORD });

    const refreshToken = login.body.tokens.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ refreshToken })
      .expect(201);

    expect(refreshed.body.tokens.refreshToken).not.toBe(refreshToken);

    // Replaying the now-revoked token is a theft signal — it must fail, and it must
    // also revoke the new token that replaced it.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-Tenant-Host', ADMIN_HOST)
      .send({ refreshToken: refreshed.body.tokens.refreshToken })
      .expect(401);
  });
});
