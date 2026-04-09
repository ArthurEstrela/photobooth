import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { DashboardGateway } from '../gateways/dashboard.gateway';
import { PaymentStatus } from '@packages/shared';

@Injectable()
export class ProcessWebhookUseCase {
  private readonly logger = new Logger(ProcessWebhookUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async execute(payload: any) {
    const { action, data } = payload;
    if (action !== 'payment.updated') return;

    const externalId = data.id.toString();
    const payment = await this.prisma.payment.findUnique({
      where: { externalId },
      include: { booth: true },
    });

    if (!payment) {
      this.logger.warn(`Payment with externalId ${externalId} not found`);
      return;
    }
    if (payment.status === PaymentStatus.APPROVED) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.APPROVED },
    });

    const eventPayload = {
      paymentId: payment.id,
      transactionId: externalId,
      amount: Number(payment.amount),
    };

    // Notify totem
    this.boothGateway.sendPaymentApproved(payment.boothId, eventPayload);
    // Notify dashboard
    this.dashboardGateway.broadcastToTenant(
      payment.booth.tenantId,
      'payment_approved',
      eventPayload,
    );

    this.logger.log(`Payment approved and notified for booth: ${payment.boothId}`);
  }
}
