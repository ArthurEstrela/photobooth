import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import { CreatePixPaymentUseCase } from '../use-cases/create-pix-payment.use-case';
import { CreateDigitalPaymentUseCase } from '../use-cases/create-digital-payment.use-case';
import { ProcessWebhookUseCase } from '../use-cases/process-webhook.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePixPaymentDTO } from '@packages/shared';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly createPixPaymentUseCase: CreatePixPaymentUseCase,
    private readonly createDigitalPaymentUseCase: CreateDigitalPaymentUseCase,
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
    private readonly prisma: PrismaService,
  ) {}

  // 10 payment attempts per minute per IP
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('pix')
  async createPixPayment(@Body() dto: CreatePixPaymentDTO) {
    return this.createPixPaymentUseCase.execute(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('digital/:sessionId')
  async createDigitalPayment(@Param('sessionId') sessionId: string) {
    return this.createDigitalPaymentUseCase.execute(sessionId);
  }

  @Get(':id')
  async getPayment(@Param('id') id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    return { id: payment.id, status: payment.status, paymentType: payment.paymentType };
  }

  // Mercado Pago retries webhooks — skip rate limiting so retries aren't blocked
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
  ) {
    this.verifyWebhookSignature(xSignature, xRequestId, payload);

    this.logger.log('Webhook received from Mercado Pago');
    this.processWebhookUseCase.execute(payload).catch((err) => {
      this.logger.error('Error processing webhook', err);
    });
    return { received: true };
  }

  /**
   * Verify Mercado Pago HMAC-SHA256 webhook signature.
   * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   *
   * The signature format is: ts=<timestamp>,v1=<hmac>
   * The signed payload is: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
   */
  private verifyWebhookSignature(
    xSignature: string | undefined,
    xRequestId: string | undefined,
    payload: any,
  ): void {
    const secret = process.env.MP_WEBHOOK_SECRET;

    // Skip verification in non-production or when secret not configured
    if (!secret || process.env.NODE_ENV !== 'production') {
      if (!secret) this.logger.warn('MP_WEBHOOK_SECRET not set — skipping signature verification');
      return;
    }

    if (!xSignature) {
      throw new UnauthorizedException('Missing x-signature header');
    }

    // Parse ts and v1 from header: "ts=1234567890,v1=abc123..."
    const parts = Object.fromEntries(
      xSignature.split(',').map((part) => part.split('=') as [string, string]),
    );
    const { ts, v1 } = parts;

    if (!ts || !v1) {
      throw new UnauthorizedException('Malformed x-signature header');
    }

    const dataId = payload?.data?.id?.toString() ?? '';
    const manifest = [
      `id:${dataId}`,
      xRequestId ? `request-id:${xRequestId}` : null,
      `ts:${ts}`,
    ]
      .filter(Boolean)
      .join(';') + ';';

    const expected = createHmac('sha256', secret).update(manifest).digest('hex');

    try {
      const isValid = timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
      if (!isValid) throw new UnauthorizedException('Invalid webhook signature');
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
