import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  createRouteRequestSchema,
  createRouteVariantRequestSchema,
  updateRouteRequestSchema,
  type CreateRouteRequest,
  type CreateRouteVariantRequest,
  type UpdateRouteRequest,
} from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.routes.list(requireCompanyId(user));
  }

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.findOne(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(createRouteRequestSchema)) body: CreateRouteRequest,
  ) {
    return this.routes.create(requireCompanyId(user), body);
  }

  @Roles('COMPANY_ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRouteRequestSchema)) body: UpdateRouteRequest,
  ) {
    return this.routes.update(requireCompanyId(user), id, body);
  }

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get(':id/variants')
  listVariants(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.listVariants(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @Post(':id/variants')
  createVariant(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createRouteVariantRequestSchema)) body: CreateRouteVariantRequest,
  ) {
    return this.routes.createVariant(requireCompanyId(user), id, body);
  }
}
