import { PrismaService } from '../../src/common/prisma/prisma.service';

export async function seedRouteWithVariant(prisma: PrismaService, companyId: string) {
  const route = await prisma.route.create({
    data: {
      companyId,
      name: 'Test Route',
      originLabel: 'A',
      destinationLabel: 'B',
      publicSlug: 'test-route',
    },
  });
  const variant = await prisma.routeVariant.create({
    data: {
      companyId,
      routeId: route.id,
      name: 'Variant 1',
      direction: 'OUTBOUND',
      headsign: 'Hacia B',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-84.0, 9.9],
          [-84.1, 10.0],
        ],
      },
      isDefault: true,
    },
  });
  return { route, variant };
}
