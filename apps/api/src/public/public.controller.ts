import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentCompanyId } from '../common/http/current-tenant.decorator';
import { PublicService } from './public.service';
import { LiveService } from '../live/live.service';

@Controller('public')
@Public()
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly live: LiveService,
  ) {}

  @Get('company')
  company(@CurrentCompanyId() companyId: string) {
    return this.publicService.getCompany(companyId);
  }

  @Get('routes')
  routes(@CurrentCompanyId() companyId: string) {
    return this.publicService.listRoutes(companyId);
  }

  @Get('routes/:slug')
  routeDetail(@CurrentCompanyId() companyId: string, @Param('slug') slug: string) {
    return this.publicService.getRouteDetail(companyId, slug);
  }

  @Get('routes/:slug/live')
  async routeLive(@CurrentCompanyId() companyId: string, @Param('slug') slug: string) {
    const buses = await this.live.getRouteLive(companyId, slug);
    return { buses };
  }

  @HttpCode(HttpStatus.OK)
  @Get('domains/allowed')
  async domainAllowed(@Query('domain') domain?: string) {
    if (!domain || !(await this.publicService.isDomainAllowed(domain))) {
      throw new NotFoundException();
    }
    return { allowed: true };
  }
}
