import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HostResolutionMiddleware } from './host-resolution.middleware';

@Module({
  providers: [HostResolutionMiddleware],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Caddy's on-demand-TLS `ask` endpoint (D17) calls this route directly with its own
    // Host header, not the customer domain it's asking about — that domain is a query
    // param. It cannot be resolved as a tenant host, so it is exempted from resolution.
    // /healthz and /readyz are infrastructure endpoints (Docker healthchecks, load
    // balancers) that never carry a tenant-meaningful Host header either.
    consumer
      .apply(HostResolutionMiddleware)
      .exclude('public/domains/allowed', 'healthz', 'readyz')
      .forRoutes('*');
  }
}
