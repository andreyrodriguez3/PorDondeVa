import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateScheduleRequest,
  ScheduleResponse,
  UpdateScheduleRequest,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForVariant(companyId: string, variantId: string): Promise<ScheduleResponse[]> {
    await this.assertVariantOwnedByCompany(companyId, variantId);
    const schedules = await this.prisma.scoped.schedule.findMany({
      where: { companyId, routeVariantId: variantId },
      orderBy: { departureTime: 'asc' },
    });
    return schedules.map(toResponse);
  }

  async create(
    companyId: string,
    variantId: string,
    dto: CreateScheduleRequest,
  ): Promise<ScheduleResponse> {
    await this.assertVariantOwnedByCompany(companyId, variantId);
    const schedule = await this.prisma.scoped.schedule.create({
      data: {
        companyId,
        routeVariantId: variantId,
        departureTime: parseWallClockTime(dto.departureTime),
        daysOfWeek: dto.daysOfWeek,
      },
    });
    return toResponse(schedule);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateScheduleRequest,
  ): Promise<ScheduleResponse> {
    const existing = await this.prisma.scoped.schedule.findFirst({ where: { companyId, id } });
    if (!existing) throw new NotFoundException();

    const schedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        departureTime: dto.departureTime ? parseWallClockTime(dto.departureTime) : undefined,
        daysOfWeek: dto.daysOfWeek,
        active: dto.active,
      },
    });
    return toResponse(schedule);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.scoped.schedule.findFirst({ where: { companyId, id } });
    if (!existing) throw new NotFoundException();
    await this.prisma.schedule.delete({ where: { id } });
  }

  private async assertVariantOwnedByCompany(companyId: string, variantId: string): Promise<void> {
    const variant = await this.prisma.scoped.routeVariant.findFirst({
      where: { companyId, id: variantId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Route variant not found in this company.');
  }
}

// Stored as a Postgres `time` via a fixed reference date (ROADMAP.md A10) — only the
// wall-clock time component is meaningful.
function parseWallClockTime(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date('1970-01-01T00:00:00Z');
  date.setUTCHours(hours!, minutes!, 0, 0);
  return date;
}

function formatWallClockTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function toResponse(schedule: {
  id: string;
  routeVariantId: string;
  departureTime: Date;
  daysOfWeek: number[];
  active: boolean;
}): ScheduleResponse {
  return {
    id: schedule.id,
    routeVariantId: schedule.routeVariantId,
    departureTime: formatWallClockTime(schedule.departureTime),
    daysOfWeek: schedule.daysOfWeek,
    active: schedule.active,
  };
}
