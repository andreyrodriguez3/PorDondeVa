import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createScheduleRequestSchema,
  updateScheduleRequestSchema,
  type CreateScheduleRequest,
  type UpdateScheduleRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { SchedulesService } from './schedules.service';

@Controller()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get('variants/:variantId/schedules')
  listForVariant(
    @CurrentUser() user: JwtPayload,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.schedules.listForVariant(requireCompanyId(user), variantId);
  }

  @Roles('COMPANY_ADMIN')
  @Post('variants/:variantId/schedules')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body(new ZodValidationPipe(createScheduleRequestSchema)) body: CreateScheduleRequest,
  ) {
    return this.schedules.create(requireCompanyId(user), variantId, body);
  }

  @Roles('COMPANY_ADMIN')
  @Patch('schedules/:id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateScheduleRequestSchema)) body: UpdateScheduleRequest,
  ) {
    return this.schedules.update(requireCompanyId(user), id, body);
  }

  @Roles('COMPANY_ADMIN')
  @Delete('schedules/:id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.remove(requireCompanyId(user), id);
  }
}
