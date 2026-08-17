import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/token.service';
import { requireCompanyId } from '../common/http/require-company-id';
import { QrService } from './qr.service';

@Controller('qr')
@Roles('COMPANY_ADMIN', 'OPERATOR')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Get('company')
  async company(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const png = await this.qr.companyQrPng(requireCompanyId(user));
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Get('route/:id')
  async route(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const png = await this.qr.routeQrPng(requireCompanyId(user), id);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }

  @Get('stop/:id')
  async stop(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const png = await this.qr.stopQrPng(requireCompanyId(user), id);
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  }
}
