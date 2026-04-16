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
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { externalId: externalId },
          ...(process.env.NODE_ENV !== 'production' ? [{ id: externalId }] : []),
        ],
      },
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

    // Digital upsell payments only need status update.
    // DeliveryScreen polls GET /payments/:id and reacts when status = APPROVED.
    if (payment.paymentType === 'DIGITAL') {
      this.logger.log(`Digital payment ${payment.id} approved`);
      return;
    }

    // Create PhotoSession so the totem can reference it for S3 sync and digital upsell
    const photoSession = await this.prisma.photoSession.create({
      data: {
        paymentId: payment.id,
        boothId: payment.boothId,
        eventId: payment.eventId,
        photoUrls: [],
      },
    });

    const eventPayload = {
      paymentId: payment.id,
      boothId: payment.boothId,
      sessionId: photoSession.id,
    };

    // Notify totem
    this.boothGateway.sendPaymentApproved(payment.boothId, eventPayload);
    // Notify dashboard
    if (payment.booth) {
      this.dashboardGateway.broadcastToTenant(
        payment.booth.tenantId,
        'payment_approved',
        eventPayload,
      );
    } else {
      this.logger.warn(`Booth not found for payment ${payment.id} — dashboard not notified`);
    }

    this.logger.log(`Payment approved, PhotoSession ${photoSession.id} created for booth: ${payment.boothId}`);
  }
}
