import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { FIXTURE_PASSWORD, seedCompanyWithUsers } from './utils/fixtures';
import { ADMIN_HOST, loginAs } from './utils/auth-helper';

describe('Buses and drivers (e2e)', () => {
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

  describe('buses', () => {
    it('lets a COMPANY_ADMIN create and list buses scoped to their company', async () => {
      const { admin } = await seedCompanyWithUsers(prisma);
      const token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);

      await request(app.getHttpServer())
        .post('/buses')
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Bus 1', licensePlate: 'AAA-111' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/buses')
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].label).toBe('Bus 1');
    });

    it('rejects a duplicate bus label within the same company with 409', async () => {
      const { admin } = await seedCompanyWithUsers(prisma);
      const token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
      const create = () =>
        request(app.getHttpServer())
          .post('/buses')
          .set('X-Tenant-Host', ADMIN_HOST)
          .set('Authorization', `Bearer ${token}`)
          .send({ label: 'Bus 1' });

      await create().expect(201);
      await create().expect(409);
    });

    it('rejects bus creation from a DRIVER role with 403', async () => {
      const { company, driver } = await seedCompanyWithUsers(prisma);
      const token = await request(app.getHttpServer())
        .post('/auth/driver/login')
        .set('X-Tenant-Host', ADMIN_HOST)
        .send({ companyCode: company.slug, username: driver.username, password: FIXTURE_PASSWORD })
        .then((res) => res.body.tokens.accessToken);

      await request(app.getHttpServer())
        .post('/buses')
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'Bus 1' })
        .expect(403);
    });

    it("returns 404 (not 403) when a company's admin requests another company's bus by id", async () => {
      const companyA = await seedCompanyWithUsers(prisma);
      const tokenA = await loginAs(app, companyA.admin.email!, FIXTURE_PASSWORD);

      const bus = await prisma.bus.create({
        data: { companyId: companyA.company.id, label: 'A-Bus' },
      });

      // Second company, second admin.
      const passwordHash = (
        await prisma.user.findUniqueOrThrow({ where: { id: companyA.admin.id } })
      ).passwordHash;
      const otherCompany = await prisma.company.create({ data: { name: 'B Co', slug: 'bco' } });
      const otherAdmin = await prisma.user.create({
        data: {
          companyId: otherCompany.id,
          email: 'admin@bco.dev',
          name: 'B Admin',
          role: 'COMPANY_ADMIN',
          passwordHash,
        },
      });
      const tokenB = await loginAs(app, otherAdmin.email!, FIXTURE_PASSWORD);

      await request(app.getHttpServer())
        .get(`/buses/${bus.id}`)
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      // Sanity: the same request from the owning company succeeds.
      await request(app.getHttpServer())
        .get(`/buses/${bus.id}`)
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
    });
  });

  describe('drivers', () => {
    it('creates a driver with a company-scoped username and no email', async () => {
      const { admin } = await seedCompanyWithUsers(prisma);
      const token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);

      const res = await request(app.getHttpServer())
        .post('/drivers')
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Driver', username: 'newdriver', password: 'NewDriverPass1!' })
        .expect(201);

      expect(res.body.username).toBe('newdriver');
      expect(res.body.status).toBe('ACTIVE');

      // The new driver can immediately log in with those credentials.
      await request(app.getHttpServer())
        .post('/auth/driver/login')
        .set('X-Tenant-Host', ADMIN_HOST)
        .send({ companyCode: 'fixtureco', username: 'newdriver', password: 'NewDriverPass1!' })
        .expect(201);
    });

    it('can update a driver default bus and deactivate them', async () => {
      const { admin, driver, company } = await seedCompanyWithUsers(prisma);
      const token = await loginAs(app, admin.email!, FIXTURE_PASSWORD);
      const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'Bus 1' } });

      const res = await request(app.getHttpServer())
        .patch(`/drivers/${driver.id}`)
        .set('X-Tenant-Host', ADMIN_HOST)
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultBusId: bus.id, status: 'INACTIVE' })
        .expect(200);

      expect(res.body.defaultBusId).toBe(bus.id);
      expect(res.body.status).toBe('INACTIVE');
    });
  });
});
