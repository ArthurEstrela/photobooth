import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreatePixPaymentUseCase } from './create-pix-payment.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrisma = {
  booth: { findUnique: jest.fn() },
  event: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
};

const mockAdapter = { createPixPayment: jest.fn() };
const mockMpOAuth = { refreshIfNeeded: jest.fn() };
const mockQueue = { add: jest.fn() };

const BOOTH = { id: 'booth-1', tenantId: 'tenant-1' };
const EVENT = { id: 'event-1', name: 'Festa' };
const MP_RESPONSE = { externalId: 111, qrCode: 'qr', qrCodeBase64: 'b64', status: 'pending' };
const PAYMENT = { id: 'pay-1', qrCode: 'qr', qrCodeBase64: 'b64' };

describe('CreatePixPaymentUseCase', () => {
  let useCase: CreatePixPaymentUseCase;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePixPaymentUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockAdapter },
        { provide: MpOAuthService, useValue: mockMpOAuth },
        { provide: getQueueToken('payment-expiration'), useValue: mockQueue },
      ],
    }).compile();

    useCase = module.get<CreatePixPaymentUseCase>(CreatePixPaymentUseCase);
    jest.clearAllMocks();
    mockPrisma.booth.findUnique.mockResolvedValue(BOOTH);
    mockPrisma.event.findUnique.mockResolvedValue(EVENT);
    mockAdapter.createPixPayment.mockResolvedValue(MP_RESPONSE);
    mockPrisma.payment.create.mockResolvedValue(PAYMENT);
    mockQueue.add.mockResolvedValue({});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.MP_ACCESS_TOKEN;
  });

  it('looks up tenant token and passes it to the adapter', async () => {
    mockMpOAuth.refreshIfNeeded.mockResolvedValue('APP_USR-tenant-token');

    await useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined });

    expect(mockMpOAuth.refreshIfNeeded).toHaveBeenCalledWith('tenant-1');
    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith(
      'APP_USR-tenant-token',
      expect.any(Object),
    );
  });

  it('throws BadRequestException when no MP token in production', async () => {
    process.env.NODE_ENV = 'production';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await expect(
      useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined }),
    ).rejects.toThrow(BadRequestException);
  });

  it('falls back to MP_ACCESS_TOKEN env var in dev when no tenant token', async () => {
    process.env.NODE_ENV = 'development';
    process.env.MP_ACCESS_TOKEN = 'DEV_TOKEN';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined });

    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('DEV_TOKEN', expect.any(Object));
  });
});
