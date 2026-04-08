// apps/api/src/app.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { BoothGateway } from './gateways/booth.gateway';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter';
import { CreatePixPaymentUseCase } from './use-cases/create-pix-payment.use-case';
import { ProcessWebhookUseCase } from './use-cases/process-webhook.use-case';
import { PaymentExpirationProcessor } from './workers/payment-expiration.processor';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'payment-expiration',
    }),
  ],
  controllers: [PaymentController],
  providers: [
    PrismaService,
    BoothGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    ProcessWebhookUseCase,
    PaymentExpirationProcessor,
  ],
})
export class AppModule {}
