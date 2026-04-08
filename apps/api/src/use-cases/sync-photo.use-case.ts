// apps/api/src/use-cases/sync-photo.use-case.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';

@Injectable()
export class SyncPhotoUseCase {
  private readonly logger = new Logger(SyncPhotoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Adapter: S3StorageAdapter,
  ) {}

  async execute(dto: { sessionId: string; photoBase64: string }) {
    this.logger.log(`Syncing photo for session: ${dto.sessionId}`);

    // 1. Upload to S3
    const photoUrl = await this.s3Adapter.uploadPhoto(dto.sessionId, dto.photoBase64);

    // 2. Update PhotoSession in Prisma
    // Assuming the PhotoSession is created during completeSession on Totem or via payment approval
    // If it doesn't exist yet, we might need to upsert it or handle the order.
    // Based on spec, we update the array of photoUrls.
    
    await this.prisma.photoSession.update({
      where: { id: dto.sessionId },
      data: {
        photoUrls: {
          push: photoUrl
        }
      }
    });

    return { success: true, url: photoUrl };
  }
}
