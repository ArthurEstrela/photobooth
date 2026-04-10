import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PixPaymentResponse } from '@packages/shared';

@Injectable()
export class CreateDigitalPaymentUseCase {
  private readonly logger = new Logger(CreateDigitalPaymentUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
    @InjectQueue('payment-expiration') private readonly paymentQueue: Queue,
  ) {}

  async execute(sessionId: string): Promise<PixPaymentResponse> {
    const session = await this.prisma.photoSession.findUnique({
      where: { id: sessionId },
      include: { event: true, booth: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.event.digitalPrice) {
      throw new BadRequestException('Digital download is free for this event');
    }

    const amount = session.event.digitalPrice.toNumber();
    const mpResponse = await this.mpAdapter.createPixPayment({
      amount,
      description: `Digital Download — ${session.event.name}`,
      metadata: { boothId: session.boothId, eventId: session.eventId, sessionId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        externalId: mpResponse.externalId.toString(),
        amount,
        qrCode: mpResponse.qrCode,
        qrCodeBase64: mpResponse.qrCodeBase64,
        status: 'PENDING',
        paymentType: 'DIGITAL',
        boothId: session.boothId,
        eventId: session.eventId,
      },
    });

    await this.paymentQueue.add(
      'expire-payment',
      { paymentId: payment.id, boothId: session.boothId },
      { delay: 2 * 60 * 1000 },
    );

    this.logger.log(`Digital payment created: ${payment.id} for session ${sessionId}`);
    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 120,
    };
  }
}
