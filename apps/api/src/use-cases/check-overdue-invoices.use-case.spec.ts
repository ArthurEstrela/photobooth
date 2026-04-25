import { Test, TestingModule } from '@nestjs/testing';
import { CheckOverdueInvoicesUseCase } from './check-overdue-invoices.use-case';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  subscriptionInvoice: { findMany: jest.fn(), updateMany: jest.fn().mockReturnValue({ count: 0 }) },
  tenant: { updateMany: jest.fn().mockReturnValue({ count: 0 }) },
  $transaction: jest.fn(),
};

describe('CheckOverdueInvoicesUseCase', () => {
  let useCase: CheckOverdueInvoicesUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckOverdueInvoicesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<CheckOverdueInvoicesUseCase>(CheckOverdueInvoicesUseCase);
    jest.clearAllMocks();
  });

  it('suspends tenants with overdue PENDING invoices', async () => {
    const invoiceUpdate = { count: 2 };
    const tenantUpdate = { count: 2 };
    mockPrisma.subscriptionInvoice.updateMany.mockReturnValue(invoiceUpdate);
    mockPrisma.tenant.updateMany.mockReturnValue(tenantUpdate);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([
      { id: 'inv-1', tenantId: 'tenant-1' },
      { id: 'inv-2', tenantId: 'tenant-2' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([]);

    await useCase.execute();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith([invoiceUpdate, tenantUpdate]);
  });

  it('does nothing when no overdue invoices exist', async () => {
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);

    await useCase.execute();

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
