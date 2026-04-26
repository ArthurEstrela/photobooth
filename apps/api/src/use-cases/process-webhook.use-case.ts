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

    // 1. Check SubscriptionInvoice first — subscription PIX are not in the Payment table
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { externalId },
    });
    if (invoice) {
      if (invoice.status === 'PAID') return; // idempotent
      await this.prisma.$transaction([
        this.prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        }),
        this.prisma.tenant.update({
          where: { id: invoice.tenantId },
          data: { subscriptionStatus: 'ACTIVE' },
        }),
      ]);
      this.logger.log(`Subscription invoice ${invoice.id} paid — tenant ${invoice.tenantId} reactivated`);
      return;
    }

    // 2. Fall through to existing Payment table lookup (photobooth session payments)
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { externalId },
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

    if (payment.paymentType === 'DIGITAL') {
      this.logger.log(`Digital payment ${payment.id} approved`);
      return;
    }

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

    this.boothGateway.sendPaymentApproved(payment.boothId, eventPayload);
    if (payment.booth) {
      this.dashboardGateway.broadcastToTenant(payment.booth.tenantId, 'payment_approved', eventPayload);
    } else {
      this.logger.warn(`Booth not found for payment ${payment.id} — dashboard not notified`);
    }

    this.logger.log(`Payment approved, PhotoSession ${photoSession.id} created for booth: ${payment.boothId}`);
  }
}
