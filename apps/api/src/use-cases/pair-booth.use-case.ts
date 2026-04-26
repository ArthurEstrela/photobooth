import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PairBoothUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async execute(code: string): Promise<{ boothId: string; token: string }> {
    const now = new Date();
    const booth = await this.prisma.booth.findFirst({
      where: {
        pairingCode: code,
        pairingCodeExpiresAt: { gt: now },
      },
    });
    if (!booth) throw new NotFoundException('Invalid or expired pairing code');

    await this.prisma.booth.update({
      where: { id: booth.id },
      data: {
        pairingCode: null,
        pairingCodeExpiresAt: null,
        pairedAt: now,
      },
    });

    const token = this.jwt.sign(
      { sub: booth.id, tenantId: booth.tenantId, role: 'booth' },
      { expiresIn: '3650d' },
    );

    return { boothId: booth.id, token };
  }
}
