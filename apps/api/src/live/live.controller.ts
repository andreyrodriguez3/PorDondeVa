import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { requireCompanyId } from '../common/http/require-company-id';
import { LiveService } from './live.service';

@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Roles('COMPANY_ADMIN', 'OPERATOR')
  @Get('fleet')
  fleet(@CurrentUser() user: JwtPayload) {
    return this.live.getFleet(requireCompanyId(user));
  }
}
