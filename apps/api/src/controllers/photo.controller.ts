// apps/api/src/controllers/photo.controller.ts

import { Controller, Post, Body, Logger } from '@nestjs/common';
import { SyncPhotoUseCase } from '../use-cases/sync-photo.use-case';

@Controller('photos')
export class PhotoController {
  private readonly logger = new Logger(PhotoController.name);

  constructor(private readonly syncPhotoUseCase: SyncPhotoUseCase) {}

  @Post('sync')
  async syncPhoto(@Body() dto: { sessionId: string; photoBase64: string }) {
    this.logger.log(`Received sync request for session ${dto.sessionId}`);
    return this.syncPhotoUseCase.execute(dto);
  }
}
