import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import {
  TenantMetrics,
  IBoothWithStatus,
  PaginatedResponse,
  IGallerySession,
  IPaymentRecord,
  ITenantSettings,
  UpdateTenantSettingsDto,
} from '@packages/shared';

interface AuthReq {
  user: RequestUser;
}

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
  ) {}

  @Get('metrics')
  async getMetrics(@Request() req: AuthReq): Promise<TenantMetrics> {
    const { tenantId } = req.user;
    const where = { booth: { tenantId } };

    const [approved, expired, rejected, revenueAgg, totalSessions] = await Promise.all([
      this.prisma.payment.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.payment.aggregate({ where: { ...where, status: 'APPROVED' }, _sum: { amount: true } }),
      this.prisma.photoSession.count({ where: { booth: { tenantId } } }),
    ]);

    const resolved = approved + expired + rejected;
    const conversionRate = resolved === 0 ? 0 : Math.round((approved / resolved) * 100);

    return {
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      totalSessions,
      conversionRate,
      activeBooths: this.boothGateway.getOnlineBoothCount(tenantId),
    };
  }

  @Get('booths')
  async getBooths(@Request() req: AuthReq): Promise<IBoothWithStatus[]> {
    const { tenantId } = req.user;
    const booths = await this.prisma.booth.findMany({ where: { tenantId } });
    return booths.map((b) => ({
      ...b,
      offlineMode: b.offlineMode as any,
      isOnline: this.boothGateway.isBoothOnline(b.id),
    }));
  }

  @Post('booths')
  async createBooth(
    @Body() body: { name: string; offlineMode?: string },
    @Request() req: AuthReq,
  ) {
    const { tenantId } = req.user;
    return this.prisma.booth.create({
      data: {
        name: body.name,
        token: randomUUID(),
        tenantId,
        offlineMode: body.offlineMode ?? 'BLOCK',
      },
    });
  }

  @Get('photos')
  async getPhotos(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<PaginatedResponse<IGallerySession>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const [sessions, total] = await Promise.all([
      this.prisma.photoSession.findMany({
        where: { booth: { tenantId } },
        include: { event: { select: { name: true } }, booth: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.photoSession.count({ where: { booth: { tenantId } } }),
    ]);

    return {
      data: sessions.map((s) => ({
        sessionId: s.id,
        photoUrls: s.photoUrls,
        eventName: s.event.name,
        boothName: s.booth.name,
        createdAt: s.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get('payments')
  async getPayments(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<PaginatedResponse<IPaymentRecord>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { booth: { tenantId } },
        include: {
          event: { select: { name: true } },
          booth: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.payment.count({ where: { booth: { tenantId } } }),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status as any,
        eventName: p.event.name,
        boothName: p.booth.name,
        createdAt: p.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  @Get('settings')
  async getSettings(@Request() req: AuthReq): Promise<ITenantSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Put('settings')
  async updateSettings(
    @Body() body: UpdateTenantSettingsDto,
    @Request() req: AuthReq,
  ): Promise<ITenantSettings> {
    return this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: body,
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
  }
}
