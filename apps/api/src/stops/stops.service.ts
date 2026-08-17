import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateStopRequest, StopResponse, UpdateStopRequest } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class StopsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<StopResponse[]> {
    const stops = await this.prisma.scoped.stop.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return stops.map(toResponse);
  }

  async findOne(companyId: string, id: string): Promise<StopResponse> {
    const stop = await this.prisma.scoped.stop.findFirst({ where: { companyId, id } });
    if (!stop) throw new NotFoundException();
    return toResponse(stop);
  }

  async create(companyId: string, dto: CreateStopRequest): Promise<StopResponse> {
    const stop = await this.prisma.scoped.stop.create({ data: { companyId, ...dto } });
    return toResponse(stop);
  }

  async update(companyId: string, id: string, dto: UpdateStopRequest): Promise<StopResponse> {
    await this.findOne(companyId, id);
    const stop = await this.prisma.scoped.stop.update({ where: { id, companyId }, data: dto });
    return toResponse(stop);
  }

  async listForVariant(companyId: string, variantId: string) {
    await this.assertVariantOwnedByCompany(companyId, variantId);
    const links = await this.prisma.scoped.routeVariantStop.findMany({
      where: { companyId, routeVariantId: variantId },
      orderBy: { sequence: 'asc' },
      include: { stop: true },
    });
    return links.map((link) => ({ ...toResponse(link.stop), sequence: link.sequence }));
  }

  async attach(companyId: string, variantId: string, stopId: string): Promise<void> {
    await this.assertVariantOwnedByCompany(companyId, variantId);
    const stop = await this.prisma.scoped.stop.findFirst({ where: { companyId, id: stopId } });
    if (!stop) throw new NotFoundException('Stop not found in this company.');

    const maxSequence = await this.prisma.scoped.routeVariantStop.aggregate({
      where: { companyId, routeVariantId: variantId },
      _max: { sequence: true },
    });

    await this.prisma.scoped.routeVariantStop.create({
      data: {
        companyId,
        routeVariantId: variantId,
        stopId,
        sequence: (maxSequence._max.sequence ?? 0) + 1,
      },
    });
  }

  async detach(companyId: string, variantId: string, stopId: string): Promise<void> {
    await this.assertVariantOwnedByCompany(companyId, variantId);
    await this.prisma.scoped.routeVariantStop.deleteMany({
      where: { companyId, routeVariantId: variantId, stopId },
    });
  }

  /**
   * Rewrites 1..N in one transaction from the caller's full ordered array (ROADMAP.md
   * §4.1 — `sequence` is deliberately not a unique constraint; correctness lives here).
   */
  async reorder(companyId: string, variantId: string, stopIds: string[]): Promise<void> {
    await this.assertVariantOwnedByCompany(companyId, variantId);

    const existing = await this.prisma.scoped.routeVariantStop.findMany({
      where: { companyId, routeVariantId: variantId },
    });
    const existingStopIds = new Set(existing.map((link) => link.stopId));

    if (stopIds.length !== existing.length || !stopIds.every((id) => existingStopIds.has(id))) {
      throw new BadRequestException(
        'stopIds must be exactly the set of stops currently attached to this variant.',
      );
    }

    await this.prisma.scoped.$transaction(
      stopIds.map((stopId, index) =>
        this.prisma.scoped.routeVariantStop.updateMany({
          where: { companyId, routeVariantId: variantId, stopId },
          data: { sequence: index + 1 },
        }),
      ),
    );
  }

  private async assertVariantOwnedByCompany(companyId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.scoped.routeVariant.findFirst({
      where: { companyId, id: variantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Route variant not found in this company.');
  }
}

function toResponse(stop: {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}): StopResponse {
  return { id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude };
}
