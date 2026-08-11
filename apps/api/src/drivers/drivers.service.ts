import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import type { CreateDriverRequest, DriverResponse, UpdateDriverRequest } from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

type DriverRecord = {
  userId: string;
  phone: string | null;
  licenseNumber: string | null;
  defaultBusId: string | null;
  status: string;
  user: { name: string; username: string | null };
};

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<DriverResponse[]> {
    const drivers = await this.prisma.scoped.driverProfile.findMany({
      where: { companyId },
      include: { user: { select: { name: true, username: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    return drivers.map(toResponse);
  }

  async findOne(companyId: string, userId: string): Promise<DriverResponse> {
    const driver = await this.prisma.scoped.driverProfile.findFirst({
      where: { companyId, userId },
      include: { user: { select: { name: true, username: true } } },
    });
    if (!driver) throw new NotFoundException();
    return toResponse(driver);
  }

  async create(companyId: string, dto: CreateDriverRequest): Promise<DriverResponse> {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    try {
      const user = await this.prisma.user.create({
        data: {
          companyId,
          username: dto.username,
          name: dto.name,
          role: 'DRIVER',
          passwordHash,
          driverProfile: {
            create: {
              companyId,
              phone: dto.phone,
              licenseNumber: dto.licenseNumber,
              defaultBusId: dto.defaultBusId,
            },
          },
        },
        include: { driverProfile: true },
      });
      return toResponse({ ...user.driverProfile!, user });
    } catch (error) {
      throw mapUniqueUsernameConflict(error);
    }
  }

  async update(
    companyId: string,
    userId: string,
    dto: UpdateDriverRequest,
  ): Promise<DriverResponse> {
    await this.findOne(companyId, userId);

    if (dto.name) {
      await this.prisma.user.update({ where: { id: userId }, data: { name: dto.name } });
    }

    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        phone: dto.phone,
        licenseNumber: dto.licenseNumber,
        defaultBusId: dto.defaultBusId,
        status: dto.status,
      },
      include: { user: { select: { name: true, username: true } } },
    });
    return toResponse(driver);
  }
}

function toResponse(driver: DriverRecord): DriverResponse {
  return {
    id: driver.userId,
    name: driver.user.name,
    username: driver.user.username!,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    defaultBusId: driver.defaultBusId,
    status: driver.status as DriverResponse['status'],
  };
}

function mapUniqueUsernameConflict(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ConflictException('A user with this username already exists in this company.');
  }
  return error as Error;
}
