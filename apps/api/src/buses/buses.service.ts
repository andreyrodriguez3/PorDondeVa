import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusResponse, CreateBusRequest, UpdateBusRequest } from '@tubus/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BusesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<BusResponse[]> {
    const buses = await this.prisma.scoped.bus.findMany({
      where: { companyId },
      orderBy: { label: 'asc' },
    });
    return buses.map(toResponse);
  }

  async findOne(companyId: string, id: string): Promise<BusResponse> {
    const bus = await this.prisma.scoped.bus.findFirst({ where: { companyId, id } });
    if (!bus) throw new NotFoundException();
    return toResponse(bus);
  }

  async create(companyId: string, dto: CreateBusRequest): Promise<BusResponse> {
    try {
      const bus = await this.prisma.scoped.bus.create({
        data: { companyId, label: dto.label, licensePlate: dto.licensePlate },
      });
      return toResponse(bus);
    } catch (error) {
      throw mapUniqueLabelConflict(error);
    }
  }

  async update(companyId: string, id: string, dto: UpdateBusRequest): Promise<BusResponse> {
    // Extended Where Unique lets `companyId` ride alongside the `id` primary key in a
    // singular update() — Prisma still targets one row by id, but the guard also sees
    // the tenant filter, so a bug elsewhere can't point this at another company's bus.
    await this.findOne(companyId, id);
    try {
      const bus = await this.prisma.scoped.bus.update({ where: { id, companyId }, data: dto });
      return toResponse(bus);
    } catch (error) {
      throw mapUniqueLabelConflict(error);
    }
  }
}

function toResponse(bus: {
  id: string;
  label: string;
  licensePlate: string | null;
  status: string;
}): BusResponse {
  return {
    id: bus.id,
    label: bus.label,
    licensePlate: bus.licensePlate,
    status: bus.status as BusResponse['status'],
  };
}

function mapUniqueLabelConflict(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ConflictException('A bus with this label already exists.');
  }
  return error as Error;
}
