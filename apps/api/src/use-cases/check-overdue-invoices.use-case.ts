import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckOverdueInvoicesUseCase {
  private readonly logger = new Logger(CheckOverdueInvoicesUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<void> {
    const now = new Date();

    const overdueInvoices = await this.prisma.subscriptionInvoice.findMany({
      where: { status: 'PENDING', dueDate: { lt: now } },
      select: { id: true, tenantId: true },
    });

    if (overdueInvoices.length === 0) return;

    const tenantIds = [...new Set(overdueInvoices.map((i) => i.tenantId))];

    await this.prisma.$transaction([
      this.prisma.subscriptionInvoice.updateMany({
        where: { id: { in: overdueInvoices.map((i) => i.id) } },
        data: { status: 'OVERDUE' },
      }),
      this.prisma.tenant.updateMany({
        where: { id: { in: tenantIds } },
        data: { subscriptionStatus: 'SUSPENDED' },
      }),
    ]);

    this.logger.log(`Suspended ${tenantIds.length} tenant(s) for overdue invoices`);
  }
}
