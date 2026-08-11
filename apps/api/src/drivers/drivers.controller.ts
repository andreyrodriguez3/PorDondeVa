import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createDriverRequestSchema,
  updateDriverRequestSchema,
  type CreateDriverRequest,
  type UpdateDriverRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.drivers.list(requireCompanyId(user));
  }

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.drivers.findOne(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createDriverRequestSchema)) body: CreateDriverRequest,
  ) {
    return this.drivers.create(requireCompanyId(user), body);
  }

  @Roles('COMPANY_ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDriverRequestSchema)) body: UpdateDriverRequest,
  ) {
    return this.drivers.update(requireCompanyId(user), id, body);
  }
}
