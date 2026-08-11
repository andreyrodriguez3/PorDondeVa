import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  // Exactly one hop: Caddy is the only proxy in front of the api (README.md — tenancy).
  app.set('trust proxy', 1);

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT') ?? 8080;

  await app.listen(port);
}

bootstrap();
