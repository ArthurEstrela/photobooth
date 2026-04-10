import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
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

  @Post('pix')
  async createPixPayment(@Body() dto: CreatePixPaymentDTO) {
    return this.createPixPaymentUseCase.execute(dto);
  }

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

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Webhook received from Mercado Pago');
    this.processWebhookUseCase.execute(payload).catch((err) => {
      this.logger.error('Error processing webhook', err);
    });
    return { received: true };
  }
}
