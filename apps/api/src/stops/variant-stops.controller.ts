import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  attachStopRequestSchema,
  reorderVariantStopsRequestSchema,
  type AttachStopRequest,
  type ReorderVariantStopsRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { StopsService } from './stops.service';

@Controller('variants/:variantId/stops')
export class VariantStopsController {
  constructor(private readonly stops: StopsService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.stops.listForVariant(requireCompanyId(user), variantId);
  }

  @Roles('COMPANY_ADMIN')
  @Post()
  attach(
    @CurrentUser() user: JwtPayload,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body(new ZodValidationPipe(attachStopRequestSchema)) body: AttachStopRequest,
  ) {
    return this.stops.attach(requireCompanyId(user), variantId, body.stopId);
  }

  @Roles('COMPANY_ADMIN')
  @Delete(':stopId')
  detach(
    @CurrentUser() user: JwtPayload,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
  ) {
    return this.stops.detach(requireCompanyId(user), variantId, stopId);
  }

  @Roles('COMPANY_ADMIN')
  @Put('order')
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body(new ZodValidationPipe(reorderVariantStopsRequestSchema)) body: ReorderVariantStopsRequest,
  ) {
    return this.stops.reorder(requireCompanyId(user), variantId, body.stopIds);
  }
}
