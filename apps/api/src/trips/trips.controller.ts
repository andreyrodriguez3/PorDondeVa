import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { requireCompanyId } from '../common/http/require-company-id';
import { TripsService } from './trips.service';

@Controller('trips')
@Roles('COMPANY_ADMIN', 'OPERATOR')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.trips.list(requireCompanyId(user), status);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.findOne(requireCompanyId(user), id);
  }

  @Get(':id/locations')
  history(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.listLocationHistory(requireCompanyId(user), id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/end')
  end(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.end(requireCompanyId(user), id, 'ADMIN');
  }

  // Restricted beyond the class-level OPERATOR access — cancelling (vs. ending) a trip
  // is rare enough, and different enough in meaning, that it stays a COMPANY_ADMIN call.
  @Roles('COMPANY_ADMIN')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.cancel(requireCompanyId(user), id);
  }
}
