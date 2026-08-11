import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { startTripRequestSchema, type StartTripRequest } from '@tubus/contracts';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { ZodValidationPipe } from '../common/zod/zod-validation.pipe';
import { requireCompanyId } from '../common/http/require-company-id';
import { TripsService } from './trips.service';

@Controller('driver')
@Roles('DRIVER')
export class DriverController {
  constructor(private readonly trips: TripsService) {}

  @Get('assignment')
  assignment(@CurrentUser() user: JwtPayload) {
    return this.trips.getAssignment(requireCompanyId(user), user.sub);
  }

  @Get('trips/active')
  active(@CurrentUser() user: JwtPayload) {
    return this.trips.findActiveForDriver(requireCompanyId(user), user.sub);
  }

  @Post('trips')
  start(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(startTripRequestSchema)) body: StartTripRequest,
  ) {
    return this.trips.start(requireCompanyId(user), user.sub, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('trips/:id/end')
  end(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.end(requireCompanyId(user), id, 'DRIVER', { driverUserId: user.sub });
  }
}
