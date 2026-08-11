import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { assertTenantScoped } from './tenant-scope.guard';

function withTenantGuard(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (model) assertTenantScoped(model, operation, args);
          return query(args);
        },
      },
    },
  });
}

export type TenantScopedPrismaClient = ReturnType<typeof withTenantGuard>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly scoped: TenantScopedPrismaClient;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
    this.scoped = withTenantGuard(this);

    (this as unknown as { $on: (e: string, cb: (e: Prisma.LogEvent) => void) => void }).$on(
      'warn',
      (e) => this.logger.warn(e.message),
    );
    (this as unknown as { $on: (e: string, cb: (e: Prisma.LogEvent) => void) => void }).$on(
      'error',
      (e) => this.logger.error(e.message),
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
