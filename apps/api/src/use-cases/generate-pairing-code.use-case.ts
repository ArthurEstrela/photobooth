import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

@Injectable()
export class GeneratePairingCodeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(boothId: string, tenantId: string): Promise<{ code: string; expiresAt: Date }> {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.booth.update({
      where: { id: boothId },
      data: { pairingCode: code, pairingCodeExpiresAt: expiresAt },
    });

    return { code, expiresAt };
  }
}
