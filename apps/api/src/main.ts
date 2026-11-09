import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_ACCESS_SECRET']) if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
  if (process.env.NODE_ENV === 'production' && (process.env.JWT_ACCESS_SECRET?.length ?? 0) < 32) throw new Error('JWT_ACCESS_SECRET must be >= 32 chars in production');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  configureApp(app, { swagger: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`SpendWise API on :${port} (docs at /api/docs)`);
}
bootstrap();
