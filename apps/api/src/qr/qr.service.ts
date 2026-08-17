import { Injectable, NotFoundException } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  async companyQrPng(companyId: string): Promise<Buffer> {
    const url = await this.primaryUrl(companyId);
    return QRCode.toBuffer(url, { type: 'png', margin: 1, width: 512 });
  }

  async routeQrPng(companyId: string, routeId: string): Promise<Buffer> {
    const route = await this.prisma.scoped.route.findFirst({
      where: { companyId, id: routeId },
      select: { publicSlug: true },
    });
    if (!route) throw new NotFoundException();

    const base = await this.primaryUrl(companyId);
    return QRCode.toBuffer(`${base}/r/${route.publicSlug}`, { type: 'png', margin: 1, width: 512 });
  }

  async stopQrPng(companyId: string, stopId: string): Promise<Buffer> {
    const stop = await this.prisma.scoped.stop.findFirst({
      where: { companyId, id: stopId },
      select: { id: true },
    });
    if (!stop) throw new NotFoundException();

    const base = await this.primaryUrl(companyId);
    return QRCode.toBuffer(`${base}/s/${stop.id}`, { type: 'png', margin: 1, width: 512 });
  }

  private async primaryUrl(companyId: string): Promise<string> {
    const domain = await this.prisma.scoped.companyDomain.findFirst({
      where: { companyId, isPrimary: true },
    });
    if (!domain) throw new NotFoundException('This company has no primary domain configured.');
    return `https://${domain.hostname}`;
  }
}
