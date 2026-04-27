import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from '../gateways/dashboard.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoothJwtGuard } from '../guards/booth-jwt.guard';
import { GeneratePairingCodeUseCase } from '../use-cases/generate-pairing-code.use-case';
import { PairBoothUseCase } from '../use-cases/pair-booth.use-case';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

interface BoothReq {
  user: { sub: string; tenantId: string; role: string };
}

@Controller('booths')
export class BoothsController {
  private readonly logger = new Logger(BoothsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardGateway: DashboardGateway,
    private readonly generatePairingCode: GeneratePairingCodeUseCase,
    private readonly pairBooth: PairBoothUseCase,
  ) {}

  @Post('pair')
  async pair(@Body() body: { code: string }) {
    return this.pairBooth.execute(body.code.toUpperCase().trim());
  }

  @UseGuards(BoothJwtGuard)
  @Post('unpair')
  async unpair(@Request() req: BoothReq) {
    const boothId = req.user.sub;
    await this.prisma.booth.update({
      where: { id: boothId },
      data: { pairedAt: null },
    });
    this.dashboardGateway.broadcastToTenant(req.user.tenantId, 'booth_unpaired', { boothId });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pairing-code')
  async generateCode(@Param('id') id: string, @Request() req: any) {
    return this.generatePairingCode.execute(id, req.user.tenantId);
  }

  @UseGuards(BoothJwtGuard)
  @Get(':id/config')
  async getConfig(@Param('id') id: string): Promise<BoothConfigDto> {
    const booth = await this.prisma.booth.findFirst({
      where: { id },
      include: { tenant: true },
    });
    if (!booth) throw new NotFoundException();

    if (!Object.values(OfflineMode).includes(booth.offlineMode as OfflineMode)) {
      throw new InternalServerErrorException(`Unknown offlineMode: ${booth.offlineMode}`);
    }

    return {
      offlineMode: booth.offlineMode as OfflineMode,
      offlineCredits: booth.offlineCredits,
      demoSessionsPerHour: booth.demoSessionsPerHour,
      cameraSound: booth.cameraSound,
      suspended: booth.tenant.subscriptionStatus === 'SUSPENDED',
      branding: {
        logoUrl: booth.tenant.logoUrl,
        primaryColor: booth.tenant.primaryColor,
        brandName: booth.tenant.brandName,
      },
      devices: {
        selectedCamera: booth.selectedCamera ?? null,
        selectedPrinter: booth.selectedPrinter ?? null,
        maintenancePin: booth.maintenancePin ?? null,
      },
    };
  }

  @UseGuards(BoothJwtGuard)
  @Get(':id/event')
  async getBoothEvent(@Param('id') id: string): Promise<BoothEventResponseDto> {
    const booth = await this.prisma.booth.findFirst({ where: { id } });
    if (!booth) throw new NotFoundException();
    if (!booth.activeEventId) throw new NotFoundException('No active event configured for this booth');

    const event = await this.prisma.event.findUnique({
      where: { id: booth.activeEventId },
      include: {
        eventTemplates: {
          orderBy: { order: 'asc' },
          include: { template: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Active event not found');

    const validPhotoCounts = [1, 2, 4] as const;
    if (!validPhotoCounts.includes(event.photoCount as 1 | 2 | 4)) {
      throw new InternalServerErrorException(`Invalid photoCount: ${event.photoCount}`);
    }

    return {
      event: {
        id: event.id,
        name: event.name,
        price: event.price.toNumber(),
        photoCount: event.photoCount as 1 | 2 | 4,
        digitalPrice: event.digitalPrice?.toNumber() ?? null,
        backgroundUrl: event.backgroundUrl,
        maxTemplates: event.maxTemplates,
      },
      templates: event.eventTemplates
        .filter((et) => !et.template.photoCount || et.template.photoCount === event.photoCount)
        .map((et) => ({
          id: et.template.id,
          name: et.template.name,
          overlayUrl: et.template.overlayUrl,
          photoCount: et.template.photoCount,
          layout: et.template.layout,
          order: et.order,
        })),
    };
  }
}
