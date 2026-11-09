import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/** Shared by main.ts and the e2e tests so tests exercise the real pipeline. */
export function configureApp(app: INestApplication, opts: { swagger?: boolean } = {}) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: false, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (opts.swagger) {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('SpendWise API').setDescription('Corporate spend & expense management (simulated cards only).').setVersion('1.0').addBearerAuth().build());
    SwaggerModule.setup('api/docs', app, doc);
  }
}
