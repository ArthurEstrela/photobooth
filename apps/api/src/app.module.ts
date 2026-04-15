import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { TenantController } from './controllers/tenant.controller';
import { EventController } from './controllers/event.controller';
import { BoothsController } from './controllers/booths.controller';
import { PaymentController } from './controllers/payment.controller';
import { PhotoController } from './controllers/photo.controller';
import { HealthController } from './controllers/health.controller';
import { BoothGateway } from './gateways/booth.gateway';
import { DashboardGateway } from './gateways/dashboard.gateway';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter';
import { CreatePixPaymentUseCase } from './use-cases/create-pix-payment.use-case';
import { CreateDigitalPaymentUseCase } from './use-cases/create-digital-payment.use-case';
import { ProcessWebhookUseCase } from './use-cases/process-webhook.use-case';
import { SyncPhotoUseCase } from './use-cases/sync-photo.use-case';
import { PaymentExpirationProcessor } from './workers/payment-expiration.processor';
import { S3StorageAdapter } from './adapters/storage/s3.adapter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    // Global rate-limit: 60 req / 60s per IP. Payment routes use stricter @Throttle decorator.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    BullModule.registerQueue({
      name: 'payment-expiration',
    }),
  ],
  controllers: [
    AuthController,
    TenantController,
    EventController,
    BoothsController,
    PaymentController,
    PhotoController,
    HealthController,
  ],
  providers: [
    // Apply ThrottlerGuard globally; individual routes can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    AuthService,
    JwtStrategy,
    BoothGateway,
    DashboardGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    CreateDigitalPaymentUseCase,
    ProcessWebhookUseCase,
    SyncPhotoUseCase,
    PaymentExpirationProcessor,
    S3StorageAdapter,
  ],
})
export class AppModule {}
