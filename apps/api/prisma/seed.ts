import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'ChangeMe123!';

async function hash(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

// San José -> Palmares, following the Interamericana Norte corridor (approximate).
const OUTBOUND_GEOMETRY = {
  type: 'LineString',
  coordinates: [
    [-84.0833, 9.9333], // San José
    [-84.2119, 10.0161], // Alajuela
    [-84.3132, 10.0708], // Grecia
    [-84.3833, 10.0997], // Naranjo
    [-84.433, 10.0575], // Palmares
  ],
};
const INBOUND_GEOMETRY = {
  type: 'LineString',
  coordinates: [...OUTBOUND_GEOMETRY.coordinates].reverse(),
};

const STOPS: Array<{ name: string; latitude: number; longitude: number }> = [
  { name: 'San José', latitude: 9.9333, longitude: -84.0833 },
  { name: 'Alajuela', latitude: 10.0161, longitude: -84.2119 },
  { name: 'Grecia', latitude: 10.0708, longitude: -84.3132 },
  { name: 'Naranjo', latitude: 10.0997, longitude: -84.3833 },
  { name: 'Palmares', latitude: 10.0575, longitude: -84.433 },
];

async function main() {
  const passwordHash = await hash(SEED_PASSWORD);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'super@tubus.dev' },
    update: {},
    create: {
      email: 'super@tubus.dev',
      name: 'TuBus Platform',
      role: 'SUPER_ADMIN',
      passwordHash,
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: 'tuanrl' },
    update: {},
    create: {
      name: 'Tuan RL',
      slug: 'tuanrl',
      timezone: 'America/Costa_Rica',
    },
  });

  await prisma.companyDomain.upsert({
    where: { hostname: 'tuanrl.localhost' },
    update: {},
    create: {
      companyId: company.id,
      hostname: 'tuanrl.localhost',
      kind: 'PLATFORM_SUBDOMAIN',
      isPrimary: true,
      verifiedAt: new Date(),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tuanrl.dev' },
    update: {},
    create: {
      companyId: company.id,
      email: 'admin@tuanrl.dev',
      name: 'Tuan RL Admin',
      role: 'COMPANY_ADMIN',
      passwordHash,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@tuanrl.dev' },
    update: {},
    create: {
      companyId: company.id,
      email: 'operator@tuanrl.dev',
      name: 'Tuan RL Operator',
      role: 'OPERATOR',
      passwordHash,
    },
  });

  const buses = await Promise.all(
    ['Bus 24', 'Bus 31', 'Bus 105'].map((label) =>
      prisma.bus.upsert({
        where: { companyId_label: { companyId: company.id, label } },
        update: {},
        create: { companyId: company.id, label, status: 'ACTIVE' },
      }),
    ),
  );

  const driverUsernames = ['driver24', 'driver31'];
  const drivers = [];
  for (const [i, username] of driverUsernames.entries()) {
    const user = await prisma.user.upsert({
      where: { companyId_username: { companyId: company.id, username } },
      update: {},
      create: {
        companyId: company.id,
        username,
        name: `Conductor ${i + 1}`,
        role: 'DRIVER',
        passwordHash,
      },
    });
    await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        companyId: company.id,
        defaultBusId: buses[i]?.id,
        status: 'ACTIVE',
      },
    });
    drivers.push(user);
  }

  const route = await prisma.route.upsert({
    where: { companyId_publicSlug: { companyId: company.id, publicSlug: 'sanjose-palmares' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'San José → Palmares',
      originLabel: 'San José',
      destinationLabel: 'Palmares',
      publicSlug: 'sanjose-palmares',
      status: 'ACTIVE',
    },
  });

  const outbound =
    (await prisma.routeVariant.findFirst({
      where: { routeId: route.id, direction: 'OUTBOUND' },
    })) ??
    (await prisma.routeVariant.create({
      data: {
        companyId: company.id,
        routeId: route.id,
        name: 'Vía Grecia (hacia Palmares)',
        direction: 'OUTBOUND',
        headsign: 'Hacia Palmares',
        geometry: OUTBOUND_GEOMETRY,
        isDefault: true,
        status: 'ACTIVE',
      },
    }));

  const inbound =
    (await prisma.routeVariant.findFirst({ where: { routeId: route.id, direction: 'INBOUND' } })) ??
    (await prisma.routeVariant.create({
      data: {
        companyId: company.id,
        routeId: route.id,
        name: 'Vía Grecia (hacia San José)',
        direction: 'INBOUND',
        headsign: 'Hacia San José',
        geometry: INBOUND_GEOMETRY,
        isDefault: false,
        status: 'ACTIVE',
      },
    }));

  const stops = [];
  for (const stopData of STOPS) {
    const stop =
      (await prisma.stop.findFirst({ where: { companyId: company.id, name: stopData.name } })) ??
      (await prisma.stop.create({ data: { companyId: company.id, ...stopData } }));
    stops.push(stop);
  }

  for (const [variant, order] of [
    [outbound, stops],
    [inbound, [...stops].reverse()],
  ] as const) {
    for (const [sequence, stop] of order.entries()) {
      await prisma.routeVariantStop.upsert({
        where: { routeVariantId_stopId: { routeVariantId: variant.id, stopId: stop.id } },
        update: { sequence: sequence + 1 },
        create: {
          companyId: company.id,
          routeVariantId: variant.id,
          stopId: stop.id,
          sequence: sequence + 1,
        },
      });
    }
  }

  const baseDate = new Date('1970-01-01T06:00:00Z');
  for (const hour of [6, 7, 8]) {
    const departureTime = new Date(baseDate);
    departureTime.setUTCHours(hour, 0, 0, 0);
    const existing = await prisma.schedule.findFirst({
      where: { routeVariantId: outbound.id, departureTime },
    });
    if (!existing) {
      await prisma.schedule.create({
        data: {
          companyId: company.id,
          routeVariantId: outbound.id,
          departureTime,
          daysOfWeek: [1, 2, 3, 4, 5],
          active: true,
        },
      });
    }
  }

  console.log('Seed complete.');
  console.log('Development-only credentials (all share one password):');
  console.log(`  password: ${SEED_PASSWORD}`);
  console.log(`  super admin: ${superAdmin.email}`);
  console.log(`  company admin: ${admin.email}`);
  console.log(`  operator: ${operator.email}`);
  console.log(`  drivers: ${drivers.map((d) => d.username).join(', ')} (company code: tuanrl)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
