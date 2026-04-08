// apps/api/src/controllers/event.controller.ts

import { Controller, Get, Post, Put, Delete, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('events')
export class EventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      const firstTenant = await this.prisma.tenant.findFirst();
      tenantId = firstTenant?.id || '';
    }

    return this.prisma.event.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() data: any, @Query('tenantId') tenantId: string) {
    if (!tenantId) {
      const firstTenant = await this.prisma.tenant.findFirst();
      tenantId = firstTenant?.id || '';
    }

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    return this.prisma.event.create({
      data: {
        name: data.name,
        price: data.price,
        overlayUrl: data.overlayUrl,
        tenantId,
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        overlayUrl: data.overlayUrl,
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.event.delete({
      where: { id },
    });
  }
}
