import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { submitLocationsRequestSchema, type SubmitLocationsRequest } from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { LocationsService } from './locations.service';

@Controller('driver/trips/:tripId/locations')
@Roles('DRIVER')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  ingest(
    @CurrentUser() user: JwtPayload,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body(new ZodValidationPipe(submitLocationsRequestSchema)) body: SubmitLocationsRequest,
  ) {
    return this.locations.ingest(requireCompanyId(user), tripId, user.sub, body.points);
  }
}
