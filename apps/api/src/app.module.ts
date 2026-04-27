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
import { MpOAuthController } from './auth/mp-oauth.controller';
import { MpOAuthService } from './auth/mp-oauth.service';
import { AdminController } from './controllers/admin.controller';
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
import { GenerateInvoicesUseCase } from './use-cases/generate-invoices.use-case';
import { CheckOverdueInvoicesUseCase } from './use-cases/check-overdue-invoices.use-case';
import { SubscriptionBillingProcessor } from './workers/subscription-billing.processor';
import { S3StorageAdapter } from './adapters/storage/s3.adapter';
import { CryptoModule } from './crypto/crypto.module';
import { BoothJwtGuard } from './guards/booth-jwt.guard';
import { GeneratePairingCodeUseCase } from './use-cases/generate-pairing-code.use-case';
import { PairBoothUseCase } from './use-cases/pair-booth.use-case';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    BullModule.registerQueue(
      { name: 'payment-expiration' },
      { name: 'subscription-billing' },
    ),
    CryptoModule,
  ],
  controllers: [
    AuthController,
    MpOAuthController,
    AdminController,
    TenantController,
    EventController,
    BoothsController,
    PaymentController,
    PhotoController,
    HealthController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    AuthService,
    JwtStrategy,
    MpOAuthService,
    BoothGateway,
    DashboardGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    CreateDigitalPaymentUseCase,
    ProcessWebhookUseCase,
    SyncPhotoUseCase,
    PaymentExpirationProcessor,
    GenerateInvoicesUseCase,
    CheckOverdueInvoicesUseCase,
    SubscriptionBillingProcessor,
    S3StorageAdapter,
    BoothJwtGuard,
    GeneratePairingCodeUseCase,
    PairBoothUseCase,
  ],
})
export class AppModule {}
