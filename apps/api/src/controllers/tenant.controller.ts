import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { RequestUser } from '../auth/jwt.strategy';
import {
  TenantMetrics,
  IBoothWithStatus,
  ITemplate,
  IEventTemplate,
  IAnalyticsData,
  OfflineMode,
  PaginatedResponse,
  IGallerySession,
  IPaymentRecord,
  ITenantSettings,
  UpdateTenantSettingsDto,
  HardwareUpdateEvent,
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
    private readonly s3: S3StorageAdapter,
    private readonly mpOAuth: MpOAuthService,
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
    const booths = await this.prisma.booth.findMany({
      where: { tenantId },
      include: { activeEvent: { select: { id: true, name: true } } },
    });
    return booths.map((b) => ({
      ...b,
      offlineMode: b.offlineMode as OfflineMode,
      isOnline: this.boothGateway.isBoothOnline(b.id),
      activeEvent: b.activeEvent,
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

  @Delete('booths/:boothId')
  async deleteBooth(@Param('boothId') boothId: string, @Request() req: AuthReq) {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId: req.user.tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');

    await this.prisma.$transaction([
      this.prisma.photoSession.deleteMany({ where: { boothId } }),
      this.prisma.payment.deleteMany({ where: { boothId } }),
      this.prisma.booth.delete({ where: { id: boothId } }),
    ]);

    return { ok: true };
  }

  @Get('photos')
  async getPhotos(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('boothId') boothId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaginatedResponse<IGallerySession>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { booth: { tenantId } };
    if (boothId) where.boothId = boothId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      this.prisma.photoSession.findMany({
        where,
        include: { event: { select: { name: true } }, booth: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.photoSession.count({ where }),
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
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaginatedResponse<IPaymentRecord>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { booth: { tenantId } };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          event: { select: { name: true } },
          booth: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status as any,
        eventName: p.event.name,
        boothName: p.booth.name,
        paymentType: (p.paymentType as 'MAIN' | 'DIGITAL') ?? 'MAIN',
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
      select: {
        logoUrl: true,
        primaryColor: true,
        brandName: true,
        mpAccessToken: true,
        mpEmail: true,
        mpConnectedAt: true,
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      brandName: tenant.brandName,
      mp: {
        connected: !!tenant.mpAccessToken,
        email: tenant.mpEmail ?? null,
        connectedAt: tenant.mpConnectedAt ?? null,
      },
    };
  }

  @Put('settings')
  async updateSettings(
    @Body() body: UpdateTenantSettingsDto,
    @Request() req: AuthReq,
  ): Promise<ITenantSettings> {
    const tenant = await this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: body,
      select: {
        logoUrl: true,
        primaryColor: true,
        brandName: true,
        mpAccessToken: true,
        mpEmail: true,
        mpConnectedAt: true,
      },
    });
    return {
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      brandName: tenant.brandName,
      mp: {
        connected: !!tenant.mpAccessToken,
        email: tenant.mpEmail ?? null,
        connectedAt: tenant.mpConnectedAt ?? null,
      },
    };
  }

  @Delete('settings/mp')
  async disconnectMp(@Request() req: AuthReq) {
    await this.mpOAuth.disconnect(req.user.tenantId);
    return { ok: true };
  }

  @Get('billing')
  async getBilling(@Request() req: AuthReq) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: {
        subscriptionStatus: true,
        pricePerBooth: true,
        billingAnchorDay: true,
        _count: { select: { booths: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const pendingInvoice = await this.prisma.subscriptionInvoice.findFirst({
      where: {
        tenantId: req.user.tenantId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: tenant.subscriptionStatus,
      pricePerBooth: Number(tenant.pricePerBooth),
      boothCount: tenant._count.booths,
      billingAnchorDay: tenant.billingAnchorDay,
      invoice: pendingInvoice
        ? {
            id: pendingInvoice.id,
            amount: Number(pendingInvoice.amount),
            dueDate: pendingInvoice.dueDate,
            status: pendingInvoice.status,
            qrCode: pendingInvoice.qrCode,
            qrCodeBase64: pendingInvoice.qrCodeBase64,
          }
        : null,
    };
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get('templates')
  async getTemplates(@Request() req: AuthReq): Promise<ITemplate[]> {
    return this.prisma.template.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  @Post('templates')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('photoCount') photoCountRaw: string | undefined,
    @Body('layout') layout: string | undefined,
    @Request() req: AuthReq,
  ): Promise<ITemplate> {
    const photoCount = photoCountRaw ? parseInt(photoCountRaw, 10) : null;
    const url = await this.s3.uploadFile('templates', file.buffer, file.mimetype);
    return this.prisma.template.create({
      data: {
        name,
        overlayUrl: url,
        photoCount,
        layout: layout ?? null,
        tenantId: req.user.tenantId,
      },
    }) as any;
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string, @Request() req: AuthReq) {
    await this.prisma.template.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    return { ok: true };
  }

  @Get('events/:id/templates')
  async getEventTemplates(
    @Param('id') eventId: string,
    @Request() req: AuthReq,
  ): Promise<IEventTemplate[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId: req.user.tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.eventTemplate.findMany({
      where: { eventId },
      include: { template: true },
      orderBy: { order: 'asc' },
    }) as any;
  }

  @Put('events/:id/templates')
  async setEventTemplates(
    @Param('id') eventId: string,
    @Body() body: { templateIds: string[] },
    @Request() req: AuthReq,
  ): Promise<IEventTemplate[]> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, tenantId: req.user.tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.eventTemplate.deleteMany({ where: { eventId } });
    if (body.templateIds.length > 0) {
      await this.prisma.eventTemplate.createMany({
        data: body.templateIds.map((templateId, order) => ({ eventId, templateId, order })),
      });
    }
    return this.getEventTemplates(eventId, req);
  }

  @Put('booths/:id/event')
  async setBoothEvent(
    @Param('id') boothId: string,
    @Body() body: { eventId: string | null },
    @Request() req: AuthReq,
  ) {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId: req.user.tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');
    return this.prisma.booth.update({
      where: { id: boothId },
      data: { activeEventId: body.eventId },
    });
  }

  @Patch('booths/:id/devices')
  async updateBoothDevices(
    @Param('id') boothId: string,
    @Body() body: { selectedCamera?: string; selectedPrinter?: string; maintenancePin?: string },
    @Request() req: AuthReq,
  ) {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId: req.user.tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');

    await this.prisma.booth.update({
      where: { id: boothId },
      data: {
        ...(body.selectedCamera !== undefined && { selectedCamera: body.selectedCamera }),
        ...(body.selectedPrinter !== undefined && { selectedPrinter: body.selectedPrinter }),
        ...(body.maintenancePin !== undefined && { maintenancePin: body.maintenancePin }),
      },
    });

    const payload: HardwareUpdateEvent = {
      selectedCamera: body.selectedCamera ?? booth.selectedCamera ?? null,
      selectedPrinter: body.selectedPrinter ?? booth.selectedPrinter ?? null,
    };
    this.boothGateway.sendForceHardwareUpdate(boothId, payload);

    return { ok: true };
  }

  @Post('settings/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthReq,
  ): Promise<{ logoUrl: string }> {
    const url = await this.s3.uploadFile('logos', file.buffer, file.mimetype);
    await this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: { logoUrl: url },
    });
    return { logoUrl: url };
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  @Get('analytics')
  async getAnalytics(
    @Request() req: AuthReq,
    @Query('period') period = '30d',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<IAnalyticsData> {
    const { tenantId } = req.user;
    const endDate = to ? new Date(to) : new Date();
    let startDate: Date;
    if (from) {
      startDate = new Date(from);
    } else {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);
    }

    const dateFilter = { gte: startDate, lte: endDate };
    const tenantFilter = { booth: { tenantId } };

    const [payments, sessions, topBoothRows] = await Promise.all([
      this.prisma.payment.findMany({
        where: { ...tenantFilter, status: 'APPROVED', createdAt: dateFilter },
        include: { event: { select: { id: true, name: true } } },
      }),
      this.prisma.photoSession.findMany({
        where: { ...tenantFilter, createdAt: dateFilter },
        select: { createdAt: true },
      }),
      this.prisma.photoSession.groupBy({
        by: ['boothId'],
        where: { ...tenantFilter, createdAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
    ]);

    const dayMap = new Map<string, { revenue: number; sessions: number }>();
    const getOrCreate = (d: string) => {
      if (!dayMap.has(d)) dayMap.set(d, { revenue: 0, sessions: 0 });
      return dayMap.get(d)!;
    };
    for (const p of payments) {
      getOrCreate(p.createdAt.toISOString().slice(0, 10)).revenue += Number(p.amount);
    }
    for (const s of sessions) {
      getOrCreate(s.createdAt.toISOString().slice(0, 10)).sessions += 1;
    }
    const series = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, sessions }]) => ({ date, revenue, sessions }));

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const avgTicket = payments.length === 0 ? 0 : totalRevenue / payments.length;

    let bestDay: { date: string; revenue: number } | null = null;
    for (const [date, { revenue }] of dayMap) {
      if (!bestDay || revenue > bestDay.revenue) bestDay = { date, revenue };
    }

    let mostActiveBooth: { name: string; sessions: number } | null = null;
    if (topBoothRows.length > 0) {
      const booth = await this.prisma.booth.findUnique({
        where: { id: topBoothRows[0].boothId },
        select: { name: true },
      });
      if (booth) mostActiveBooth = { name: booth.name, sessions: topBoothRows[0]._count.id };
    }

    const eventRevMap = new Map<string, { name: string; revenue: number }>();
    for (const p of payments) {
      const e = eventRevMap.get(p.eventId) ?? { name: p.event.name, revenue: 0 };
      e.revenue += Number(p.amount);
      eventRevMap.set(p.eventId, e);
    }
    const topEvents = Array.from(eventRevMap.entries())
      .map(([id, { name, revenue }]) => ({ id, name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return { series, totalRevenue, avgTicket, bestDay, mostActiveBooth, topEvents };
  }
}
