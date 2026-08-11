import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../../auth/token.service';

/**
 * Every admin-surface route in this file is restricted to company-scoped roles
 * (COMPANY_ADMIN/OPERATOR/DRIVER), so `companyId` is always present in practice — this
 * only guards against a future role being added to a `@Roles(...)` list without also
 * being given a company.
 */
export function requireCompanyId(user: JwtPayload): string {
  if (!user.companyId) {
    throw new ForbiddenException('This action requires a company-scoped account.');
  }
  return user.companyId;
}
