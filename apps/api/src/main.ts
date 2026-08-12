import 'reflect-metadata';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  // Company logos are the only thing this API serves as static files, so the
  // default helmet CSP (which would block <img> from a different-origin admin UI
  // in production behind Caddy) doesn't need loosening for anything else.
  app.use(helmet());
  // Exactly one hop: Caddy is the only proxy in front of the api (README.md — tenancy).
  app.set('trust proxy', 1);

  const config = app.get(ConfigService);
  const uploadsDir = path.resolve(config.get<string>('UPLOADS_DIR')!);
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  const port = config.get<number>('API_PORT') ?? 8080;

  await app.listen(port);
}

bootstrap();
