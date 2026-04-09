import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';
import { DashboardGateway } from '../gateways/dashboard.gateway';

@Injectable()
export class SyncPhotoUseCase {
  private readonly logger = new Logger(SyncPhotoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Adapter: S3StorageAdapter,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async execute(dto: { sessionId: string; photoBase64: string }) {
    this.logger.log(`Syncing photo for session: ${dto.sessionId}`);

    const photoUrl = await this.s3Adapter.uploadPhoto(dto.sessionId, dto.photoBase64);

    await this.prisma.photoSession.update({
      where: { id: dto.sessionId },
      data: { photoUrls: { push: photoUrl } },
    });

    const session = await this.prisma.photoSession.findUnique({
      where: { id: dto.sessionId },
      include: { booth: { select: { tenantId: true } } },
    });

    if (session) {
      this.dashboardGateway.broadcastToTenant(session.booth.tenantId, 'photo_synced', {
        sessionId: dto.sessionId,
        photoUrl,
        tenantId: session.booth.tenantId,
      });
    }

    return { success: true, url: photoUrl };
  }
}
