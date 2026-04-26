import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SubStatus } from '@prisma/client';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Get('tenants')
  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        mpAccessToken: true,
        _count: { select: { booths: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      createdAt: t.createdAt,
      mpConnected: !!t.mpAccessToken,
      boothCount: t._count.booths,
    }));
  }

  @Post('tenants/:tenantId/billing')
  async updateTenantBilling(
    @Param('tenantId') tenantId: string,
    @Body() body: { pricePerBooth?: number; subscriptionStatus?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (body.subscriptionStatus !== undefined) {
      const allowed = Object.values(SubStatus);
      if (!allowed.includes(body.subscriptionStatus as SubStatus)) {
        throw new BadRequestException(`Invalid subscriptionStatus. Allowed: ${allowed.join(', ')}`);
      }
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(body.pricePerBooth !== undefined && { pricePerBooth: body.pricePerBooth }),
        ...(body.subscriptionStatus !== undefined && { subscriptionStatus: body.subscriptionStatus as SubStatus }),
      },
      select: { id: true, subscriptionStatus: true, pricePerBooth: true },
    });
  }

  @Post('impersonate/:tenantId')
  async impersonate(@Param('tenantId') tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, email: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const token = this.jwt.sign(
      { sub: tenant.id, email: tenant.email, impersonated: true },
      { expiresIn: '7d' },
    );
    return { token, tenantId: tenant.id, email: tenant.email };
  }
}
