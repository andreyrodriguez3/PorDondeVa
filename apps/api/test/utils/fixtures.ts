import * as argon2 from 'argon2';
import { PrismaService } from '../../src/common/prisma/prisma.service';

export const FIXTURE_PASSWORD = 'FixturePass123!';

export async function seedCompanyWithUsers(prisma: PrismaService) {
  const passwordHash = await argon2.hash(FIXTURE_PASSWORD, { type: argon2.argon2id });

  const company = await prisma.company.create({
    data: { name: 'Fixture Co', slug: 'fixtureco' },
  });

  await prisma.companyDomain.create({
    data: {
      companyId: company.id,
      hostname: 'fixtureco.localhost',
      kind: 'PLATFORM_SUBDOMAIN',
      isPrimary: true,
      verifiedAt: new Date(),
    },
  });

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@fixtureco.dev',
      name: 'Fixture Admin',
      role: 'COMPANY_ADMIN',
      passwordHash,
    },
  });

  const driver = await prisma.user.create({
    data: {
      companyId: company.id,
      username: 'fixturedriver',
      name: 'Fixture Driver',
      role: 'DRIVER',
      passwordHash,
    },
  });

  return { company, admin, driver };
}

export async function seedSecondCompany(prisma: PrismaService) {
  const passwordHash = await argon2.hash(FIXTURE_PASSWORD, { type: argon2.argon2id });

  const company = await prisma.company.create({
    data: { name: 'Other Co', slug: 'otherco' },
  });

  await prisma.companyDomain.create({
    data: {
      companyId: company.id,
      hostname: 'otherco.localhost',
      kind: 'PLATFORM_SUBDOMAIN',
      isPrimary: true,
      verifiedAt: new Date(),
    },
  });

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@otherco.dev',
      name: 'Other Admin',
      role: 'COMPANY_ADMIN',
      passwordHash,
    },
  });

  return { company, admin };
}
