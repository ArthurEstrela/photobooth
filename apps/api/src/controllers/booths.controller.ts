import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

@Controller('booths')
export class BoothsController {
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

    const event = await this.prisma.event.findFirst({
      where: { tenantId: booth.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { templates: true },
    });
    if (!event) throw new NotFoundException('No active event found for this booth');

    return {
      event: {
        id: event.id,
        name: event.name,
        price: Number(event.price),
        photoCount: event.photoCount as 1 | 2 | 4,
      },
      templates: event.templates,
    };
  }
}
