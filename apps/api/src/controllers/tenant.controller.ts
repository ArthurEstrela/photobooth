// apps/api/src/controllers/tenant.controller.ts

import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('tenant')
export class TenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics')
  async getMetrics(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      // In a real scenario, this would come from the JWT/Session
      // For now, let's try to get the first tenant if not provided
      const firstTenant = await this.prisma.tenant.findFirst();
      tenantId = firstTenant?.id || '';
    }

    const [payments, photoSessions] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: 'APPROVED',
          booth: {
            tenantId,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.photoSession.count({
        where: {
          booth: {
            tenantId,
          },
        },
      }),
    ]);

    return {
      totalRevenue: payments._sum.amount || 0,
      totalSessions: photoSessions,
    };
  }
}
