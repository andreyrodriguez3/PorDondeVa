import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { createTestApp, truncateAll } from './utils/test-app';
import { seedCompanyWithUsers } from './utils/fixtures';
import { seedRouteWithVariant } from './utils/route-fixtures';

describe('Maintenance jobs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let maintenance: MaintenanceService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    maintenance = app.get(MaintenanceService);
  });

  afterEach(async () => {
    await truncateAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('purges location points older than the retention window, leaving newer ones intact', async () => {
    const { company, driver } = await seedCompanyWithUsers(prisma);
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'B1' } });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);
    const trip = await prisma.trip.create({
      data: {
        companyId: company.id,
        routeId: route.id,
        routeVariantId: variant.id,
        busId: bus.id,
        driverUserId: driver.id,
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const recent = new Date();
    await prisma.locationPoint.createMany({
      data: [
        {
          tripId: trip.id,
          companyId: company.id,
          clientPointId: 'a0000000-0000-0000-0000-000000000001',
          latitude: 1,
          longitude: 1,
          deviceTimestamp: old,
          serverTimestamp: old,
        },
        {
          tripId: trip.id,
          companyId: company.id,
          clientPointId: 'a0000000-0000-0000-0000-000000000002',
          latitude: 2,
          longitude: 2,
          deviceTimestamp: recent,
          serverTimestamp: recent,
        },
      ],
    });

    await maintenance.purgeOldLocations();

    const remaining = await prisma.locationPoint.findMany({ where: { tripId: trip.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.clientPointId).toBe('a0000000-0000-0000-0000-000000000002');
  });

  it('auto-completes a trip with no location update for longer than the timeout', async () => {
    const { company, driver } = await seedCompanyWithUsers(prisma);
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'B1' } });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);
    const longAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const trip = await prisma.trip.create({
      data: {
        companyId: company.id,
        routeId: route.id,
        routeVariantId: variant.id,
        busId: bus.id,
        driverUserId: driver.id,
        status: 'ACTIVE',
        startedAt: longAgo,
      },
    });

    await maintenance.sweepStaleTrips();

    const updated = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(updated.status).toBe('COMPLETED');
    expect(updated.endReason).toBe('AUTO_TIMEOUT');
  });

  it('does not touch a trip with a recent live update', async () => {
    const { company, driver } = await seedCompanyWithUsers(prisma);
    const bus = await prisma.bus.create({ data: { companyId: company.id, label: 'B1' } });
    const { route, variant } = await seedRouteWithVariant(prisma, company.id);
    const trip = await prisma.trip.create({
      data: {
        companyId: company.id,
        routeId: route.id,
        routeVariantId: variant.id,
        busId: bus.id,
        driverUserId: driver.id,
        status: 'ACTIVE',
      },
    });
    await prisma.tripLiveState.create({
      data: {
        tripId: trip.id,
        companyId: company.id,
        routeId: route.id,
        routeVariantId: variant.id,
        busId: bus.id,
        latitude: 1,
        longitude: 1,
        deviceTimestamp: new Date(),
        serverTimestamp: new Date(),
      },
    });

    await maintenance.sweepStaleTrips();

    const unchanged = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(unchanged.status).toBe('ACTIVE');
  });

  it('purges expired refresh tokens', async () => {
    const { admin } = await seedCompanyWithUsers(prisma);
    const expired = await prisma.refreshToken.create({
      data: {
        userId: admin.id,
        tokenHash: 'expired-hash',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const valid = await prisma.refreshToken.create({
      data: {
        userId: admin.id,
        tokenHash: 'valid-hash',
        expiresAt: new Date(Date.now() + 100_000),
      },
    });

    await maintenance.purgeExpiredTokens();

    const remaining = await prisma.refreshToken.findMany({ where: { userId: admin.id } });
    expect(remaining.map((t) => t.id)).toEqual([valid.id]);
    expect(remaining.map((t) => t.id)).not.toContain(expired.id);
  });
});
