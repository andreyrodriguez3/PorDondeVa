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
    // Ownership is verified against companyId first; the update itself then targets the
    // row by its own primary key. Bus has no (companyId, id) compound unique for the
    // scoped client's update() to use, so this one call uses the raw client — the same
    // documented exception as the auth module (D14's known limit on nested/nonstandard
    // writes).
    await this.findOne(companyId, id);
    try {
      const bus = await this.prisma.bus.update({ where: { id }, data: dto });
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
