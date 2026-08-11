import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';

/**
 * Structured JSON logs to stdout only (D18). Redacts credentials, tags every request
 * with a correlation id, and skips per-point ingest noise (§35 in SPECS.md) — the
 * locations module logs one line per accepted batch instead, at debug level.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          genReqId: (req: { headers: Record<string, unknown> }) =>
            (req.headers['x-request-id'] as string) ?? randomUUID(),
          redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
          autoLogging: {
            ignore: (req: { url?: string }) => req.url === '/healthz' || req.url === '/readyz',
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
