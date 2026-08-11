import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { updateRouteVariantRequestSchema, type UpdateRouteVariantRequest } from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { RoutesService } from './routes.service';

@Controller('variants')
export class VariantsController {
  constructor(private readonly routes: RoutesService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.routes.findVariant(requireCompanyId(user), id);
  }

  @Roles('COMPANY_ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRouteVariantRequestSchema)) body: UpdateRouteVariantRequest,
  ) {
    return this.routes.updateVariant(requireCompanyId(user), id, body);
  }
}
