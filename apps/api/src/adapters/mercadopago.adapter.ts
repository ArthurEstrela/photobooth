// apps/api/src/adapters/mercadopago.adapter.ts

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';

export interface MercadoPagoPixResponse {
  externalId: number;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
}

@Injectable()
export class MercadoPagoAdapter {
  private readonly logger = new Logger(MercadoPagoAdapter.name);
  private readonly apiUrl = 'https://api.mercadopago.com/v1';
  private readonly accessToken = process.env.MP_ACCESS_TOKEN;

  async createPixPayment(data: {
    amount: number;
    description: string;
    metadata: any;
  }): Promise<MercadoPagoPixResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          transaction_amount: data.amount,
          description: data.description,
          payment_method_id: 'pix',
          payer: {
            email: process.env.MP_PAYER_EMAIL ?? 'cliente@photobooth.com.br',
          },
          ...(process.env.API_URL
            ? { notification_url: `${process.env.API_URL}/payments/webhook` }
            : {}),
          metadata: data.metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'X-Idempotency-Key': randomUUID(),
          },
        },
      );

      const paymentData = response.data;

      return {
        externalId: paymentData.id,
        qrCode: paymentData.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        status: paymentData.status,
      };
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('⚠️ Mercado Pago API falhou (Provavelmente não foi para produção). Retornando PIX MOCK de testes! ⚠️');
        return {
          externalId: Date.now(),
          qrCode: '00020101021243650016COM.BR.MOCK...',
          qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAADElEQVQI12P4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC', // tiny 1x1 image
          status: 'PENDING',
        };
      }
      this.logger.error('Error creating Mercado Pago Pix payment', error.response?.data || error.message);
      throw new Error('Failed to create Pix payment via Mercado Pago');
    }
  }
}
