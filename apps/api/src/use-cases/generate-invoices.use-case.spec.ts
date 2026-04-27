import { Test, TestingModule } from '@nestjs/testing';
import { GenerateInvoicesUseCase } from './generate-invoices.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';

const mockPrisma = {
  tenant: { findMany: jest.fn(), update: jest.fn() },
  subscriptionInvoice: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockMpAdapter = { createPixPayment: jest.fn() };

const TENANT = {
  id: 'tenant-1',
  pricePerBooth: { valueOf: () => 200, toNumber: () => 200, toString: () => '200' },
  peakBoothCount: 5, // peak was 5 even though current count is 3
  _count: { booths: 3 },
};

const MP_RESPONSE = {
  externalId: 99999,
  qrCode: 'qr-string',
  qrCodeBase64: 'base64-string',
};

describe('GenerateInvoicesUseCase', () => {
  let useCase: GenerateInvoicesUseCase;
  const originalEnv = process.env.MP_ACCESS_TOKEN;

  beforeEach(async () => {
    process.env.MP_ACCESS_TOKEN = 'test-mp-token';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateInvoicesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockMpAdapter },
      ],
    }).compile();
    useCase = module.get<GenerateInvoicesUseCase>(GenerateInvoicesUseCase);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.MP_ACCESS_TOKEN = originalEnv;
  });

  it('generates invoice and PIX for tenant with booths', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([TENANT]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    mockPrisma.subscriptionInvoice.create.mockResolvedValue({ id: 'inv-1' });
    mockMpAdapter.createPixPayment.mockResolvedValue(MP_RESPONSE);
    mockPrisma.subscriptionInvoice.update.mockResolvedValue({});
    mockPrisma.tenant.update.mockResolvedValue({});

    await useCase.execute();

    // Uses peak (5) not current count (3) — R$200 × 5 = R$1000
    expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1000 }) }),
    );
    expect(mockMpAdapter.createPixPayment).toHaveBeenCalledWith(
      'test-mp-token',
      expect.objectContaining({ amount: 1000, description: expect.stringContaining('5 cabine') }),
    );
    expect(mockPrisma.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalId: '99999', qrCode: 'qr-string' }),
      }),
    );
    // Resets peak to current count after billing
    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tenant-1' }, data: { peakBoothCount: 3 } }),
    );
  });

  it('skips tenant if invoice already exists this period (idempotency)', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([TENANT]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({ id: 'existing-inv' });

    await useCase.execute();

    expect(mockMpAdapter.createPixPayment).not.toHaveBeenCalled();
  });

  it('skips tenant with 0 booths', async () => {
    const tenantNoBooths = { ...TENANT, peakBoothCount: 0, _count: { booths: 0 } };
    mockPrisma.tenant.findMany.mockResolvedValue([tenantNoBooths]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

    await useCase.execute();

    expect(mockPrisma.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(mockMpAdapter.createPixPayment).not.toHaveBeenCalled();
  });
});
