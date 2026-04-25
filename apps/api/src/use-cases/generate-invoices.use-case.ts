import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';

@Injectable()
export class GenerateInvoicesUseCase {
  private readonly logger = new Logger(GenerateInvoicesUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
  ) {}

  async execute(): Promise<void> {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new Error('MP_ACCESS_TOKEN environment variable is not set');

    const today = new Date().getDate();

    const tenants = await this.prisma.tenant.findMany({
      where: { billingAnchorDay: today, subscriptionStatus: 'ACTIVE' },
      include: { _count: { select: { booths: true } } },
    });

    for (const tenant of tenants) {
      // Idempotency: skip if invoice already generated this calendar month
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const existing = await this.prisma.subscriptionInvoice.findFirst({
        where: { tenantId: tenant.id, createdAt: { gte: periodStart } },
      });
      if (existing) continue;

      const boothCount = tenant._count.booths;
      if (boothCount === 0) continue;

      const amount = Number(tenant.pricePerBooth) * boothCount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      try {
        const invoice = await this.prisma.subscriptionInvoice.create({
          data: {
            tenantId: tenant.id,
            boothCount,
            pricePerBooth: tenant.pricePerBooth,
            amount,
            dueDate,
          },
        });

        const mpResponse = await this.mpAdapter.createPixPayment(accessToken, {
          amount,
          description: `Assinatura PhotoBooth — ${boothCount} cabine(s)`,
          metadata: { type: 'subscription', tenantId: tenant.id, invoiceId: invoice.id },
        });

        await this.prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            externalId: mpResponse.externalId.toString(),
            qrCode: mpResponse.qrCode,
            qrCodeBase64: mpResponse.qrCodeBase64,
          },
        });

        this.logger.log(`Invoice generated for tenant ${tenant.id}: R$${amount}`);
      } catch (err: any) {
        this.logger.error(`Failed to generate PIX for tenant ${tenant.id}: ${err?.message}`);
      }
    }
  }
}
