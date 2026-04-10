import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';

interface AuthReq {
  user: RequestUser;
}

interface CreateEventDto {
  name: string;
  price: number;
  photoCount?: number;
  digitalPrice?: number | null;
  backgroundUrl?: string | null;
  maxTemplates?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Request() req: AuthReq) {
    return this.prisma.event.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() data: CreateEventDto, @Request() req: AuthReq) {
    return this.prisma.event.create({
      data: {
        name: data.name,
        price: data.price,
        photoCount: data.photoCount ?? 1,
        digitalPrice: data.digitalPrice ?? null,
        backgroundUrl: data.backgroundUrl ?? null,
        maxTemplates: data.maxTemplates ?? 5,
        tenantId: req.user.tenantId,
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: CreateEventDto) {
    return this.prisma.event.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
        photoCount: data.photoCount,
        digitalPrice: data.digitalPrice,
        backgroundUrl: data.backgroundUrl,
        maxTemplates: data.maxTemplates,
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
