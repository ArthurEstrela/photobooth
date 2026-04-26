import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateDigitalPaymentUseCase } from './create-digital-payment.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrisma = {
  photoSession: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
  tenant: { findUnique: jest.fn() },
};
const mockAdapter = { createPixPayment: jest.fn() };
const mockMpOAuth = { refreshIfNeeded: jest.fn() };
const mockQueue = { add: jest.fn() };

const SESSION = {
  id: 'session-1',
  boothId: 'booth-1',
  eventId: 'event-1',
  booth: { id: 'booth-1', tenantId: 'tenant-1' },
  event: { id: 'event-1', name: 'Festa', digitalPrice: { toNumber: () => 25 } },
};
const MP_RESPONSE = { externalId: 222, qrCode: 'qr', qrCodeBase64: 'b64', status: 'pending' };
const PAYMENT = { id: 'pay-2', qrCode: 'qr', qrCodeBase64: 'b64' };

describe('CreateDigitalPaymentUseCase', () => {
  let useCase: CreateDigitalPaymentUseCase;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDigitalPaymentUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockAdapter },
        { provide: MpOAuthService, useValue: mockMpOAuth },
        { provide: getQueueToken('payment-expiration'), useValue: mockQueue },
      ],
    }).compile();

    useCase = module.get<CreateDigitalPaymentUseCase>(CreateDigitalPaymentUseCase);
    jest.clearAllMocks();
    mockPrisma.photoSession.findUnique.mockResolvedValue(SESSION);
    mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' });
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

    await useCase.execute('session-1');

    expect(mockMpOAuth.refreshIfNeeded).toHaveBeenCalledWith('tenant-1');
    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('APP_USR-tenant-token', expect.any(Object));
  });

  it('throws 402 Payment Required when tenant subscription is SUSPENDED', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'SUSPENDED' });

    await expect(useCase.execute('session-1')).rejects.toMatchObject({ status: 402 });
  });

  it('throws BadRequestException when no MP token in production', async () => {
    process.env.NODE_ENV = 'production';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await expect(useCase.execute('session-1')).rejects.toThrow(BadRequestException);
  });

  it('falls back to MP_ACCESS_TOKEN env var in dev', async () => {
    process.env.NODE_ENV = 'development';
    process.env.MP_ACCESS_TOKEN = 'DEV_TOKEN';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await useCase.execute('session-1');

    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('DEV_TOKEN', expect.any(Object));
  });

  it('throws NotFoundException when session does not exist', async () => {
    mockPrisma.photoSession.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('bad-session')).rejects.toThrow(NotFoundException);
  });
});
