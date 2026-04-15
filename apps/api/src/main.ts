// apps/api/src/main.ts

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });
// fallback local (if deployed/container)
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

// ── Validate required environment variables before the app starts ──────────────
function validateEnv() {
  const logger = new Logger('Bootstrap');
  const required: string[] = ['JWT_SECRET', 'DATABASE_URL'];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    logger.warn('MP_ACCESS_TOKEN not set — payment creation will fail');
  }

  if (!process.env.MP_WEBHOOK_SECRET) {
    logger.warn('MP_WEBHOOK_SECRET not set — webhook signature verification is DISABLED');
  }

  if (!process.env.AWS_S3_BUCKET) {
    logger.warn('AWS_S3_BUCKET not set — photo uploads will fail');
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // ── Security headers ─────────────────────────────────────────────────────────
  app.use(
    helmet({
      // Allow inline styles/scripts needed by Vite dev & Socket.IO
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  // ── Global exception filter (no stack-trace leaks in production) ─────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Input validation ─────────────────────────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const rawOrigins = process.env.ALLOWED_ORIGINS ?? '';
    const allowedOrigins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (allowedOrigins.length === 0) {
      logger.warn(
        'ALLOWED_ORIGINS is not set — CORS will block all cross-origin requests in production!',
      );
    }

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin '${origin}' not allowed`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`API running on port ${port} [${isProduction ? 'production' : 'development'}]`);
}

bootstrap();
