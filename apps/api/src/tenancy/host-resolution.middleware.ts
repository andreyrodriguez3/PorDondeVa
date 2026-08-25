import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service';
import { CompanyContext } from './company-context';

/**
 * Resolves the tenant from the incoming Host header before any controller runs
 * (README.md "How multi-tenancy works" / D5). The admin host never carries a tenant in
 * the hostname — that surface resolves its company from the authenticated session instead.
 *
 * The proxy is trusted for exactly one hop: only `X-Forwarded-Host` is honored, and only
 * because Nest's `app.set('trust proxy', 1)` (wired in main.ts) makes Express parse it.
 * An unrecognized hostname yields 404, never a default tenant.
 */
@Injectable()
export class HostResolutionMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const hostname = this.resolveHostname(req);
    const adminHost = this.config.get<string>('ADMIN_HOST');

    if (hostname === adminHost) {
      return CompanyContext.run({ companyId: null, hostname, isAdminHost: true }, () => next());
    }

    const domain = await this.prisma.companyDomain.findUnique({
      where: { hostname },
      select: { companyId: true, verifiedAt: true, company: { select: { status: true } } },
    });

    // A suspended company's passenger site 404s exactly like an unverified/unknown
    // domain — "suspended" isn't a distinct state a passenger should be able to detect.
    if (!domain || !domain.verifiedAt || domain.company.status !== 'ACTIVE') {
      throw new NotFoundException();
    }

    CompanyContext.run({ companyId: domain.companyId, hostname, isAdminHost: false }, () => next());
  }

  private resolveHostname(req: Request): string {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (nodeEnv !== 'production') {
      const override = req.headers['x-tenant-host'];
      if (typeof override === 'string' && override.length > 0) {
        return override.toLowerCase();
      }
    }
    const host = req.hostname || req.headers.host || '';
    return (host.split(':')[0] ?? '').toLowerCase();
  }
}
