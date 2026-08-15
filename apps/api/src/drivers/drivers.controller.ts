import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createDriverRequestSchema,
  resetDriverPasswordRequestSchema,
  updateDriverRequestSchema,
  type CreateDriverRequest,
  type ResetDriverPasswordRequest,
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

  // A21 — admin-issued reset, no email needed: the driver never proves they know the
  // old password (they may have forgotten it, which is the whole point), only the
  // COMPANY_ADMIN resetting it needs to be authenticated and own this driver.
  @Roles('COMPANY_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/password')
  resetPassword(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resetDriverPasswordRequestSchema)) body: ResetDriverPasswordRequest,
  ) {
    return this.drivers.resetPassword(requireCompanyId(user), id, body.password);
  }
}
