// apps/api/src/use-cases/create-pix-payment.use-case.ts

import { Injectable } from '@nestjs/common';
import { CreatePixPaymentDTO, PixPaymentResponse } from '@packages/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';

@Injectable()
export class CreatePixPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
  ) {}

  async execute(dto: CreatePixPaymentDTO): Promise<PixPaymentResponse> {
    // 1. Verify booth and event existence
    const booth = await this.prisma.booth.findUnique({ where: { id: dto.boothId } });
    if (!booth) throw new Error('Booth not found');

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new Error('Event not found');

    // 2. Request Pix Payment to Mercado Pago
    const mpResponse = await this.mpAdapter.createPixPayment({
      amount: dto.amount,
      description: `Photo Session - ${event.name}`,
      metadata: { boothId: dto.boothId, eventId: dto.eventId },
    });

    // 3. Persist payment in database
    const payment = await this.prisma.payment.create({
      data: {
        externalId: mpResponse.externalId.toString(),
        amount: dto.amount,
        qrCode: mpResponse.qrCode,
        qrCodeBase64: mpResponse.qrCodeBase64,
        status: 'PENDING',
        boothId: dto.boothId,
        eventId: dto.eventId,
      },
    });

    // 4. Return formatted response to Totem
    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 3600, // MP default or custom
    };
  }
}
