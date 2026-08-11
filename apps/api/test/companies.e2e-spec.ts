import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

describe('Companies (e2e)', () => {
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

  it('reads and updates the company profile', async () => {
    const before = await request(app.getHttpServer()).get('/companies/me').set(auth()).expect(200);
    expect(before.body.name).toBe('Fixture Co');

    const after = await request(app.getHttpServer())
      .patch('/companies/me')
      .set(auth())
      .send({ name: 'Renamed Co', brandPrimaryColor: '#112233' })
      .expect(200);
    expect(after.body.name).toBe('Renamed Co');
    expect(after.body.brandPrimaryColor).toBe('#112233');
  });

  it('lists the seeded domain and adds a second one, marking the first as primary', async () => {
    const res = await request(app.getHttpServer())
      .get('/companies/me/domains')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].isPrimary).toBe(true);

    const added = await request(app.getHttpServer())
      .post('/companies/me/domains')
      .set(auth())
      .send({ hostname: 'rutas.example.com' })
      .expect(201);
    expect(added.body.isPrimary).toBe(false);
  });

  it('rejects a duplicate hostname across the platform with 409', async () => {
    await request(app.getHttpServer())
      .post('/companies/me/domains')
      .set(auth())
      .send({ hostname: 'fixtureco.localhost' })
      .expect(409);
  });

  it('verifies a domain that actually resolves, and rejects one that does not', async () => {
    const added = await request(app.getHttpServer())
      .post('/companies/me/domains')
      .set(auth())
      .send({ hostname: 'example.com' })
      .expect(201);

    const verified = await request(app.getHttpServer())
      .post(`/companies/me/domains/${added.body.id}/verify`)
      .set(auth())
      .expect(201);
    expect(verified.body.verifiedAt).not.toBeNull();

    const unresolvable = await request(app.getHttpServer())
      .post('/companies/me/domains')
      .set(auth())
      .send({ hostname: 'this-domain-does-not-exist-tubus-test.invalid' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/companies/me/domains/${unresolvable.body.id}/verify`)
      .set(auth())
      .expect(400);
  });

  it('removes a domain', async () => {
    const added = await request(app.getHttpServer())
      .post('/companies/me/domains')
      .set(auth())
      .send({ hostname: 'todelete.example.com' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/companies/me/domains/${added.body.id}`)
      .set(auth())
      .expect(204);

    const res = await request(app.getHttpServer())
      .get('/companies/me/domains')
      .set(auth())
      .expect(200);
    expect(res.body.find((d: { id: string }) => d.id === added.body.id)).toBeUndefined();
  });
});
