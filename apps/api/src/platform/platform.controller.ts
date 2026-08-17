import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createCompanyAdminRequestSchema,
  createCompanyRequestSchema,
  updateCompanyStatusRequestSchema,
  type CreateCompanyAdminRequest,
  type CreateCompanyRequest,
  type UpdateCompanyStatusRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { PlatformService } from './platform.service';

@Controller('platform')
@Roles('SUPER_ADMIN')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('companies')
  listCompanies() {
    return this.platform.listCompanies();
  }

  @Post('companies')
  createCompany(
    @Body(new ZodValidationPipe(createCompanyRequestSchema)) body: CreateCompanyRequest,
  ) {
    return this.platform.createCompany(body);
  }

  @Patch('companies/:id')
  updateCompanyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCompanyStatusRequestSchema)) body: UpdateCompanyStatusRequest,
  ) {
    return this.platform.updateCompanyStatus(id, body);
  }

  @Post('companies/:id/admins')
  createCompanyAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createCompanyAdminRequestSchema)) body: CreateCompanyAdminRequest,
  ) {
    return this.platform.createCompanyAdmin(id, body);
  }
}
