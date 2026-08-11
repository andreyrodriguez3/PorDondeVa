import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HostResolutionMiddleware } from './host-resolution.middleware';

@Module({
  providers: [HostResolutionMiddleware],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HostResolutionMiddleware).forRoutes('*');
  }
}
