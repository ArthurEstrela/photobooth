import { Test } from '@nestjs/testing';
import { TenantController } from './tenant.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';

const mockPrisma = {
  payment: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
  photoSession: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  booth: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  tenant: { findUnique: jest.fn(), update: jest.fn() },
  template: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  eventTemplate: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  event: { findFirst: jest.fn() },
};

const mockBoothGateway = {
  getOnlineBoothCount: jest.fn(),
  isBoothOnline: jest.fn(),
};

const TENANT_USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('TenantController', () => {
  let controller: TenantController;
  const mockS3 = { uploadFile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
        { provide: S3StorageAdapter, useValue: mockS3 },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TenantController);
  });

  it('GET /tenant/metrics returns calculated metrics', async () => {
    mockPrisma.payment.count.mockResolvedValueOnce(10); // approved
    mockPrisma.payment.count.mockResolvedValueOnce(2); // expired
    mockPrisma.payment.count.mockResolvedValueOnce(1); // rejected
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 300 } });
    mockPrisma.photoSession.count.mockResolvedValue(8);
    mockBoothGateway.getOnlineBoothCount.mockReturnValue(2);

    const result = await controller.getMetrics(TENANT_USER as any);

    expect(result.totalRevenue).toBe(300);
    expect(result.conversionRate).toBe(77); // 10 / (10+2+1) = 0.769
    expect(result.activeBooths).toBe(2);
  });

  describe('Templates', () => {
    it('GET /tenant/templates returns tenant templates', async () => {
      mockPrisma.template.findMany.mockResolvedValue([
        { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', tenantId: 'tenant-1', createdAt: new Date() },
      ]);

      const result = await controller.getTemplates(TENANT_USER as any);

      expect(mockPrisma.template.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t-1');
    });

    it('DELETE /tenant/templates/:id deletes only tenant template', async () => {
      mockPrisma.template.deleteMany.mockResolvedValue({ count: 1 });

      const result = await controller.deleteTemplate('t-1', TENANT_USER as any);

      expect(mockPrisma.template.deleteMany).toHaveBeenCalledWith({
        where: { id: 't-1', tenantId: 'tenant-1' },
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('Analytics', () => {
    it('GET /tenant/analytics aggregates revenue and sessions by day', async () => {
      const today = new Date('2026-04-10T12:00:00Z');
      const yesterday = new Date('2026-04-09T12:00:00Z');

      mockPrisma.payment.findMany.mockResolvedValue([
        { amount: 30, createdAt: today, event: { name: 'E1' }, eventId: 'e1' },
        { amount: 20, createdAt: today, event: { name: 'E1' }, eventId: 'e1' },
        { amount: 40, createdAt: yesterday, event: { name: 'E2' }, eventId: 'e2' },
      ]);
      mockPrisma.photoSession.findMany.mockResolvedValue([
        { createdAt: today },
        { createdAt: yesterday },
        { createdAt: yesterday },
      ]);
      mockPrisma.photoSession.groupBy.mockResolvedValue([{ boothId: 'b1', _count: { id: 5 } }]);
      mockPrisma.booth.findUnique.mockResolvedValue({ name: 'Booth 1' });

      const result = await controller.getAnalytics(TENANT_USER as any, '7d');

      expect(result.totalRevenue).toBe(90);
      expect(result.series).toHaveLength(2);
      expect(result.series[0].date).toBe('2026-04-09');
      expect(result.series[0].revenue).toBe(40);
      expect(result.series[0].sessions).toBe(2);
      expect(result.series[1].date).toBe('2026-04-10');
      expect(result.series[1].revenue).toBe(50);
      expect(result.series[1].sessions).toBe(1);
      expect(result.bestDay?.date).toBe('2026-04-10');
      expect(result.mostActiveBooth?.name).toBe('Booth 1');
    });
  });
});
