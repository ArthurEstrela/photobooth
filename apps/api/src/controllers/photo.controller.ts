// apps/api/src/controllers/photo.controller.ts

import { Controller, Post, Get, Body, Param, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SyncPhotoUseCase } from '../use-cases/sync-photo.use-case';
import { PrismaService } from '../prisma/prisma.service';

@Controller('photos')
export class PhotoController {
  private readonly logger = new Logger(PhotoController.name);

  constructor(
    private readonly syncPhotoUseCase: SyncPhotoUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post('sync')
  async syncPhoto(@Body() dto: { sessionId: string; photoBase64: string }) {
    this.logger.log(`Received sync request for session ${dto.sessionId}`);
    try {
      return await this.syncPhotoUseCase.execute(dto);
    } catch (err: any) {
      const detail = err?.message ?? String(err);
      this.logger.error(`syncPhoto failed for session ${dto.sessionId}: ${detail}`);
      throw new InternalServerErrorException(
        process.env.NODE_ENV !== 'production' ? detail : 'Photo sync failed',
      );
    }
  }

  @Get('public/:sessionId')
  async getPublicSession(@Param('sessionId') sessionId: string) {
    const session = await this.prisma.photoSession.findUnique({
      where: { id: sessionId },
      select: { id: true, photoUrls: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    return { sessionId: session.id, photoUrls: session.photoUrls };
  }
}
