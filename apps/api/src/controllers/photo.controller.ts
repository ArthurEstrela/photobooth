// apps/api/src/controllers/photo.controller.ts

import { Controller, Post, Get, Body, Param, Query, Res, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('proxy')
  async proxyImage(
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url || !url.startsWith('https://') || (!url.includes('.amazonaws.com') && !url.includes('.cloudfront.net'))) {
      throw new BadRequestException('Invalid URL');
    }
    let response: globalThis.Response;
    try {
      response = await fetch(url);
    } catch {
      throw new NotFoundException('Could not fetch image');
    }
    if (!response.ok) throw new NotFoundException('Image not found');
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
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
