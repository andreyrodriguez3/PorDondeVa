import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateRouteRequest,
  CreateRouteVariantRequest,
  RouteResponse,
  RouteVariantResponse,
  UpdateRouteRequest,
  UpdateRouteVariantRequest,
} from '@tubus/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string): Promise<RouteResponse[]> {
    const routes = await this.prisma.scoped.route.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return routes.map(toRouteResponse);
  }

  async findOne(companyId: string, id: string): Promise<RouteResponse> {
    const route = await this.prisma.scoped.route.findFirst({ where: { companyId, id } });
    if (!route) throw new NotFoundException();
    return toRouteResponse(route);
  }

  async create(companyId: string, dto: CreateRouteRequest): Promise<RouteResponse> {
    try {
      const route = await this.prisma.scoped.route.create({
        data: {
          companyId,
          name: dto.name,
          originLabel: dto.originLabel,
          destinationLabel: dto.destinationLabel,
          publicSlug: dto.publicSlug,
        },
      });
      return toRouteResponse(route);
    } catch (error) {
      throw mapUniqueSlugConflict(error);
    }
  }

  async update(companyId: string, id: string, dto: UpdateRouteRequest): Promise<RouteResponse> {
    await this.findOne(companyId, id);
    const route = await this.prisma.scoped.route.update({ where: { id, companyId }, data: dto });
    return toRouteResponse(route);
  }

  async listVariants(companyId: string, routeId: string): Promise<RouteVariantResponse[]> {
    await this.findOne(companyId, routeId);
    const variants = await this.prisma.scoped.routeVariant.findMany({
      where: { companyId, routeId },
      orderBy: { name: 'asc' },
    });
    return variants.map(toVariantResponse);
  }

  async findVariant(companyId: string, variantId: string): Promise<RouteVariantResponse> {
    const variant = await this.prisma.scoped.routeVariant.findFirst({
      where: { companyId, id: variantId },
    });
    if (!variant) throw new NotFoundException();
    return toVariantResponse(variant);
  }

  async createVariant(
    companyId: string,
    routeId: string,
    dto: CreateRouteVariantRequest,
  ): Promise<RouteVariantResponse> {
    await this.findOne(companyId, routeId);

    if (dto.isDefault) {
      await this.prisma.scoped.routeVariant.updateMany({
        where: { companyId, routeId },
        data: { isDefault: false },
      });
    }

    // A route with no default variant renders no stops and no direction on the
    // public page (A23) — the first variant a route gets is the default one whether
    // or not the caller asked for it, so that state is never reachable through the UI.
    const existingCount = await this.prisma.scoped.routeVariant.count({
      where: { companyId, routeId },
    });
    const isDefault = dto.isDefault ?? existingCount === 0;

    const variant = await this.prisma.scoped.routeVariant.create({
      data: {
        companyId,
        routeId,
        name: dto.name,
        direction: dto.direction,
        headsign: dto.headsign,
        geometry: dto.geometry,
        isDefault,
      },
    });
    return toVariantResponse(variant);
  }

  async updateVariant(
    companyId: string,
    variantId: string,
    dto: UpdateRouteVariantRequest,
  ): Promise<RouteVariantResponse> {
    const existing = await this.findVariant(companyId, variantId);

    if (dto.isDefault) {
      await this.prisma.scoped.routeVariant.updateMany({
        where: { companyId, routeId: existing.routeId, id: { not: variantId } },
        data: { isDefault: false },
      });
    }

    const variant = await this.prisma.scoped.routeVariant.update({
      where: { id: variantId, companyId },
      data: {
        name: dto.name,
        headsign: dto.headsign,
        geometry: dto.geometry,
        isDefault: dto.isDefault,
        status: dto.status,
      },
    });
    return toVariantResponse(variant);
  }
}

function toRouteResponse(route: {
  id: string;
  name: string;
  originLabel: string;
  destinationLabel: string;
  publicSlug: string;
  status: string;
}): RouteResponse {
  return {
    id: route.id,
    name: route.name,
    originLabel: route.originLabel,
    destinationLabel: route.destinationLabel,
    publicSlug: route.publicSlug,
    status: route.status as RouteResponse['status'],
  };
}

function toVariantResponse(variant: {
  id: string;
  routeId: string;
  name: string;
  direction: string;
  headsign: string;
  geometry: Prisma.JsonValue;
  isDefault: boolean;
  status: string;
}): RouteVariantResponse {
  return {
    id: variant.id,
    routeId: variant.routeId,
    name: variant.name,
    direction: variant.direction as RouteVariantResponse['direction'],
    headsign: variant.headsign,
    geometry: variant.geometry as RouteVariantResponse['geometry'],
    isDefault: variant.isDefault,
    status: variant.status as RouteVariantResponse['status'],
  };
}

function mapUniqueSlugConflict(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ConflictException('A route with this public slug already exists.');
  }
  return error as Error;
}
