import { Test, TestingModule } from '@nestjs/testing';
import { ProcessWebhookUseCase } from './process-webhook.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { DashboardGateway } from '../gateways/dashboard.gateway';

const mockPrisma = {
  subscriptionInvoice: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  tenant: { update: jest.fn().mockResolvedValue({}) },
  payment: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  photoSession: { create: jest.fn() },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockBoothGateway = { sendPaymentApproved: jest.fn(), sendPaymentExpired: jest.fn() };
const mockDashboardGateway = { broadcastToTenant: jest.fn() };

const SUBSCRIPTION_PAYLOAD = { action: 'payment.updated', data: { id: 'mp-sub-999' } };

describe('ProcessWebhookUseCase — subscription', () => {
  let useCase: ProcessWebhookUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessWebhookUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
        { provide: DashboardGateway, useValue: mockDashboardGateway },
      ],
    }).compile();
    useCase = module.get<ProcessWebhookUseCase>(ProcessWebhookUseCase);
    jest.clearAllMocks();
  });

  it('marks subscription invoice PAID and reactivates tenant', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      status: 'PENDING',
    });

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
    // Booth gateway should NOT be called for subscription payments
    expect(mockBoothGateway.sendPaymentApproved).not.toHaveBeenCalled();
  });

  it('is idempotent — does nothing for already-PAID subscription invoice', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      status: 'PAID',
    });

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('falls through to Payment table when no subscription invoice matches', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    mockPrisma.payment.findFirst.mockResolvedValue(null);

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    // No crash, just warns
    expect(mockPrisma.payment.findFirst).toHaveBeenCalled();
  });
});
