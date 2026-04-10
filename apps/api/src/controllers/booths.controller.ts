import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

@Controller('booths')
export class BoothsController {
  private readonly logger = new Logger(BoothsController.name);

  constructor(private readonly prisma: PrismaService) {}

  private extractToken(auth: string | undefined): string | undefined {
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  }

  @Get(':id/config')
  async getConfig(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothConfigDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({
      where: { id, token },
      include: { tenant: true },
    });
    if (!booth) throw new UnauthorizedException();

    if (!Object.values(OfflineMode).includes(booth.offlineMode as OfflineMode)) {
      throw new InternalServerErrorException(`Unknown offlineMode: ${booth.offlineMode}`);
    }

    return {
      offlineMode: booth.offlineMode as OfflineMode,
      offlineCredits: booth.offlineCredits,
      demoSessionsPerHour: booth.demoSessionsPerHour,
      cameraSound: booth.cameraSound,
      branding: {
        logoUrl: booth.tenant.logoUrl,
        primaryColor: booth.tenant.primaryColor,
        brandName: booth.tenant.brandName,
      },
    };
  }

  @Get(':id/event')
  async getBoothEvent(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothEventResponseDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({ where: { id, token } });
    if (!booth) throw new UnauthorizedException();
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
      templates: event.eventTemplates.map((et) => ({
        id: et.template.id,
        name: et.template.name,
        overlayUrl: et.template.overlayUrl,
        order: et.order,
      })),
    };
  }
}
