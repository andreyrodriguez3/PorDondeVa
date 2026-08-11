import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { Prisma } from '@prisma/client';
import type {
  CompanyProfileResponse,
  CreateDomainRequest,
  DomainResponse,
  UpdateCompanyRequest,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(companyId: string): Promise<CompanyProfileResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    return toProfileResponse(company);
  }

  async updateProfile(
    companyId: string,
    dto: UpdateCompanyRequest,
  ): Promise<CompanyProfileResponse> {
    const company = await this.prisma.company.update({ where: { id: companyId }, data: dto });
    return toProfileResponse(company);
  }

  async listDomains(companyId: string): Promise<DomainResponse[]> {
    const domains = await this.prisma.scoped.companyDomain.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    return domains.map(toDomainResponse);
  }

  async addDomain(companyId: string, dto: CreateDomainRequest): Promise<DomainResponse> {
    const existingCount = await this.prisma.scoped.companyDomain.count({ where: { companyId } });
    try {
      const domain = await this.prisma.scoped.companyDomain.create({
        data: {
          companyId,
          hostname: dto.hostname,
          kind: 'CUSTOM',
          isPrimary: existingCount === 0,
        },
      });
      return toDomainResponse(domain);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This hostname is already registered.');
      }
      throw error;
    }
  }

  /**
   * D17 — a hostname is marked verified once its DNS record resolves. This is a
   * best-effort lookup, not a check that it points at this platform specifically;
   * Caddy's own on-demand-TLS `ask` step is the actual gate before a certificate is
   * issued.
   */
  async verifyDomain(companyId: string, domainId: string): Promise<DomainResponse> {
    const domain = await this.prisma.scoped.companyDomain.findFirst({
      where: { companyId, id: domainId },
    });
    if (!domain) throw new NotFoundException();

    try {
      await dns.lookup(domain.hostname);
    } catch {
      throw new BadRequestException('This hostname does not resolve yet. Check your DNS records.');
    }

    const updated = await this.prisma.companyDomain.update({
      where: { id: domainId },
      data: { verifiedAt: new Date() },
    });
    return toDomainResponse(updated);
  }

  async removeDomain(companyId: string, domainId: string): Promise<void> {
    const domain = await this.prisma.scoped.companyDomain.findFirst({
      where: { companyId, id: domainId },
    });
    if (!domain) throw new NotFoundException();
    await this.prisma.companyDomain.delete({ where: { id: domainId } });
  }
}

function toProfileResponse(company: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  logoPath: string | null;
  brandPrimaryColor: string | null;
  liveThresholdSeconds: number;
  staleThresholdSeconds: number;
}): CompanyProfileResponse {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    timezone: company.timezone,
    logoPath: company.logoPath,
    brandPrimaryColor: company.brandPrimaryColor,
    liveThresholdSeconds: company.liveThresholdSeconds,
    staleThresholdSeconds: company.staleThresholdSeconds,
  };
}

function toDomainResponse(domain: {
  id: string;
  hostname: string;
  kind: string;
  isPrimary: boolean;
  verifiedAt: Date | null;
}): DomainResponse {
  return {
    id: domain.id,
    hostname: domain.hostname,
    kind: domain.kind as DomainResponse['kind'],
    isPrimary: domain.isPrimary,
    verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
  };
}
