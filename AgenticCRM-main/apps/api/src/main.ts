// Load environment variables before any other imports
import path from 'path';
import dotenv from 'dotenv';
// Load .env from project root (2 levels up from apps/api/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { validateRuntimeConfig } from './common/runtime-config';
import { prisma } from '@wacrm/database';
import Redis from 'ioredis';

async function bootstrap() {
  validateRuntimeConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    // `rawBody: true` makes `req.rawBody` available for HMAC signature
    // verification on webhook receivers (Meta Lead Ads, payment providers).
    rawBody: true,
  });

  // ── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());
  const configuredCorsOrigins = (process.env.CORS_ORIGINS || `https://${process.env.DOMAIN}`)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? configuredCorsOrigins : true,
    credentials: true,
  });

  // ── Global pipes / filters / interceptors ──────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── API prefix ────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger ───────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AgenticCRM')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth')
      .addTag('conversations')
      .addTag('contacts')
      .addTag('leads')
      .addTag('deals')
      .addTag('tasks')
      .addTag('payments')
      .addTag('whatsapp')
      .addTag('settings')
      .addTag('analytics')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ── Health check (used by Docker healthcheck) ─────────────────────────────
  const expressApp = app.getHttpAdapter().getInstance() as import('express').Application;
  expressApp.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Readiness checks dependencies without exposing credentials or internal errors.
  expressApp.get('/api/ready', async (_req, res) => {
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      connectTimeout: 2500,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.connect();
      await redis.ping();
      res.status(200).json({ status: 'ready', checks: { database: 'ok', redis: 'ok' }, timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'not_ready', checks: { database: 'unknown', redis: 'unknown' }, timestamp: new Date().toISOString() });
    } finally {
      redis.disconnect();
    }
  });

  // ── Raw body for webhook signature verification ────────────────────────────
  app.useBodyParser('json', { limit: '10mb' });

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);

  // Increase server timeouts for long AI chat calls (tool iterations can take 2+ minutes)
  const server = app.getHttpServer();
  server.keepAliveTimeout = 300_000;  // 5 minutes
  server.headersTimeout = 305_000;    // slightly above keepAliveTimeout

  console.log(`API running on http://localhost:${port}/api`);
  console.log(`Swagger at http://localhost:${port}/api/docs`);
}

bootstrap();
