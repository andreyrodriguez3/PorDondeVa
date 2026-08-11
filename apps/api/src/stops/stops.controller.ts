import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createStopRequestSchema,
  updateStopRequestSchema,
  type CreateStopRequest,
  type UpdateStopRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { StopsService } from './stops.service';

@Controller('stops')
export class StopsController {
  constructor(private readonly stops: StopsService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.stops.list(requireCompanyId(user));
  }

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.stops.findOne(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createStopRequestSchema)) body: CreateStopRequest,
  ) {
    return this.stops.create(requireCompanyId(user), body);
  }

  @Roles('COMPANY_ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStopRequestSchema)) body: UpdateStopRequest,
  ) {
    return this.stops.update(requireCompanyId(user), id, body);
  }
}
