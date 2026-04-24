import { Injectable, BadRequestException } from '@nestjs/common';
import { CreatePixPaymentDTO, PixPaymentResponse } from '@packages/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class CreatePixPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
    private readonly mpOAuth: MpOAuthService,
    @InjectQueue('payment-expiration') private readonly paymentQueue: Queue,
  ) {}

  async execute(dto: CreatePixPaymentDTO): Promise<PixPaymentResponse> {
    const booth = await this.prisma.booth.findUnique({ where: { id: dto.boothId } });
    if (!booth) throw new Error('Booth not found');

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new Error('Event not found');

    let accessToken: string;
    try {
      accessToken = await this.mpOAuth.refreshIfNeeded(booth.tenantId);
    } catch {
      if (process.env.NODE_ENV !== 'production' && process.env.MP_ACCESS_TOKEN) {
        accessToken = process.env.MP_ACCESS_TOKEN;
      } else {
        throw new BadRequestException(
          'Conta Mercado Pago não conectada. Configure nas Configurações.',
        );
      }
    }

    const mpResponse = await this.mpAdapter.createPixPayment(accessToken, {
      amount: dto.amount,
      description: `Photo Session - ${event.name}`,
      metadata: { boothId: dto.boothId, eventId: dto.eventId },
    });

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

    await this.paymentQueue.add(
      'expire-payment',
      { paymentId: payment.id, boothId: dto.boothId },
      { delay: 2 * 60 * 1000 },
    );

    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 120,
    };
  }
}
