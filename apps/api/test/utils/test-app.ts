import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * Boots the real AppModule against whatever `DATABASE_URL` points at (CI runs a
 * postgres service container; locally this targets a dev/test Postgres — see
 * README.md for how to reach one without Docker Desktop). Every test file gets its
 * own app instance, and truncates tenant tables between tests rather than between
 * files, so tests stay independent without paying for a fresh migration each time.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

const TABLES_IN_DEPENDENCY_ORDER = [
  'audit_logs',
  'trip_incidents',
  'trip_live_states',
  'location_points',
  'trips',
  'schedules',
  'route_variant_stops',
  'stops',
  'route_variants',
  'routes',
  'buses',
  'refresh_tokens',
  'driver_profiles',
  'users',
  'company_domains',
  'companies',
];

export async function truncateAll(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES_IN_DEPENDENCY_ORDER.map((t) => `"${t}"`).join(', ')} CASCADE`,
  );
}
