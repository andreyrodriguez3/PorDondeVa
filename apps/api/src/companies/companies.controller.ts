import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createDomainRequestSchema,
  updateCompanyRequestSchema,
  type CreateDomainRequest,
  type UpdateCompanyRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { CompaniesService } from './companies.service';

@Controller('companies/me')
@Roles('COMPANY_ADMIN', 'OPERATOR')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  profile(@CurrentUser() user: JwtPayload) {
    return this.companies.getProfile(requireCompanyId(user));
  }

  @Roles('COMPANY_ADMIN')
  @Patch()
  update(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updateCompanyRequestSchema)) body: UpdateCompanyRequest,
  ) {
    return this.companies.updateProfile(requireCompanyId(user), body);
  }

  @Get('domains')
  listDomains(@CurrentUser() user: JwtPayload) {
    return this.companies.listDomains(requireCompanyId(user));
  }

  @Roles('COMPANY_ADMIN')
  @Post('domains')
  addDomain(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createDomainRequestSchema)) body: CreateDomainRequest,
  ) {
    return this.companies.addDomain(requireCompanyId(user), body);
  }

  @Roles('COMPANY_ADMIN')
  @Post('domains/:id/verify')
  verifyDomain(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.companies.verifyDomain(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('domains/:id')
  async removeDomain(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    await this.companies.removeDomain(requireCompanyId(user), id);
  }
}
