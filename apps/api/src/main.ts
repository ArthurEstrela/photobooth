// apps/api/src/main.ts

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../../.env') });
// fallback local (if deployed/container)
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

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
