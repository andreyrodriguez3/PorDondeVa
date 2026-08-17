import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import type {
  CreateCompanyAdminRequest,
  CreateCompanyAdminResponse,
  CreateCompanyRequest,
  PlatformCompanyResponse,
  UpdateCompanyStatusRequest,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { ARGON2_OPTIONS } from '../auth/auth.service';

// SUPER_ADMIN is the one legitimate cross-tenant actor in the system (D-A7) — every
// query here is intentionally unscoped by companyId, unlike every other service.
@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanies(): Promise<PlatformCompanyResponse[]> {
    const companies = await this.prisma.company.findMany({ orderBy: { name: 'asc' } });
    return companies.map(toResponse);
  }

  async createCompany(dto: CreateCompanyRequest): Promise<PlatformCompanyResponse> {
    try {
      const company = await this.prisma.company.create({
        data: { name: dto.name, slug: dto.slug, timezone: dto.timezone },
      });
      return toResponse(company);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A company with this slug already exists.');
      }
      throw error;
    }
  }

  async updateCompanyStatus(
    companyId: string,
    dto: UpdateCompanyStatusRequest,
  ): Promise<PlatformCompanyResponse> {
    try {
      const company = await this.prisma.company.update({
        where: { id: companyId },
        data: { status: dto.status },
      });
      return toResponse(company);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /**
   * The only way a company gets its first admin — self-service signup is out of scope
   * (D-A20). Mirrors the admin-issued driver password reset (A21): a one-time password
   * generated here, shown to the caller exactly once, with mustChangePassword forcing a
   * change on first login.
   */
  async createCompanyAdmin(
    companyId: string,
    dto: CreateCompanyAdminRequest,
  ): Promise<CreateCompanyAdminResponse> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException();

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword, ARGON2_OPTIONS);

    try {
      const user = await this.prisma.user.create({
        data: {
          companyId,
          email: dto.email,
          name: dto.name,
          role: 'COMPANY_ADMIN',
          passwordHash,
          mustChangePassword: true,
        },
      });
      return { userId: user.id, email: dto.email, temporaryPassword };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }
}

// 8 random bytes, hex-encoded (16 chars), plus a fixed letter+digit suffix — guarantees
// passwordSchema's rules (min 10, at least one letter and one digit) by construction,
// not by the odds of a random slice happening to contain both.
function generateTemporaryPassword(): string {
  return `${randomBytes(8).toString('hex')}A1`;
}

function toResponse(company: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: string;
  createdAt: Date;
}): PlatformCompanyResponse {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    timezone: company.timezone,
    status: company.status as PlatformCompanyResponse['status'],
    createdAt: company.createdAt.toISOString(),
  };
}
