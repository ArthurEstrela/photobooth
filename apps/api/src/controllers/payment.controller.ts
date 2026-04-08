// apps/api/src/controllers/payment.controller.ts

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { CreatePixPaymentUseCase } from '../use-cases/create-pix-payment.use-case';
import { ProcessWebhookUseCase } from '../use-cases/process-webhook.use-case';
import { CreatePixPaymentDTO } from '@packages/shared';

@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly createPixPaymentUseCase: CreatePixPaymentUseCase,
    private readonly processWebhookUseCase: ProcessWebhookUseCase,
  ) {}

  @Post('pix')
  async createPixPayment(@Body() dto: CreatePixPaymentDTO) {
    return this.createPixPaymentUseCase.execute(dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.log('Webhook received from Mercado Pago');
    
    // We process asynchronously to return 200/OK quickly as required by MP
    this.processWebhookUseCase.execute(payload).catch(err => {
      this.logger.error('Error processing webhook', err);
    });

    return { received: true };
  }
}
