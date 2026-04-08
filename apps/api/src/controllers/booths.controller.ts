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
    if (!token) {
      this.logger.warn(`Unauthorized booth config request: boothId=${id}`);
      throw new UnauthorizedException();
    }

    const booth = await this.prisma.booth.findFirst({
      where: { id, token },
      include: { tenant: true },
    });
    if (!booth) {
      this.logger.warn(`Unauthorized booth config request: boothId=${id}`);
      throw new UnauthorizedException();
    }

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
    if (!token) {
      this.logger.warn(`Unauthorized booth event request: boothId=${id}`);
      throw new UnauthorizedException();
    }

    const booth = await this.prisma.booth.findFirst({ where: { id, token } });
    if (!booth) {
      this.logger.warn(`Unauthorized booth event request: boothId=${id}`);
      throw new UnauthorizedException();
    }

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
        price: event.price.toNumber(),
        photoCount: event.photoCount as 1 | 2 | 4,
      },
      templates: event.templates,
    };
  }
}
