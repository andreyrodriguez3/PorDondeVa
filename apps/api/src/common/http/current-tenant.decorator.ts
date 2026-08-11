import { createParamDecorator, ExecutionContext, NotFoundException } from '@nestjs/common';
import { CompanyContext } from '../../tenancy/company-context';

/**
 * For public (unauthenticated) passenger routes: the tenant comes from the resolved
 * Host header (set by HostResolutionMiddleware), never from a JWT. Throws 404 rather
 * than 500 if somehow called without a resolved tenant context — an unresolved host is
 * indistinguishable from "not found" to a passenger.
 */
export const CurrentCompanyId = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string => {
    const context = CompanyContext.get();
    if (!context || !context.companyId) {
      throw new NotFoundException();
    }
    return context.companyId;
  },
);
