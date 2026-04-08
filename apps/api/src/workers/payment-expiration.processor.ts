// apps/api/src/workers/payment-expiration.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { PaymentStatus } from '@packages/shared';

@Processor('payment-expiration')
export class PaymentExpirationProcessor {
  private readonly logger = new Logger(PaymentExpirationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
  ) {}

  @Process('expire-payment')
  async handleExpiration(job: Job<{ paymentId: string; boothId: string }>) {
    const { paymentId, boothId } = job.data;
    
    // 1. Fetch current payment status
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      this.logger.error(`Payment ${paymentId} not found during expiration check`);
      return;
    }

    // 2. If already APPROVED, ignore expiration
    if (payment.status === PaymentStatus.APPROVED) {
      this.logger.log(`Payment ${paymentId} already APPROVED, skipping expiration`);
      return;
    }

    // 3. Update to EXPIRED
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.EXPIRED },
    });

    // 4. Notify Totem to return to IDLE
    this.boothGateway.sendPaymentExpired(boothId);
    
    this.logger.log(`Payment ${paymentId} expired and booth ${boothId} notified`);
  }
}
