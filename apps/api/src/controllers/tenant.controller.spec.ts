import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const mockPrisma = {
  payment: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  photoSession: { count: jest.fn(), findMany: jest.fn() },
  booth: { findMany: jest.fn(), create: jest.fn() },
  event: { findMany: jest.fn() },
  tenant: { findUnique: jest.fn(), update: jest.fn() },
};

const mockBoothGateway = {
  isBoothOnline: jest.fn(),
  getOnlineBoothCount: jest.fn(),
};

const TENANT_USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('TenantController — getMetrics', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns totalRevenue, totalSessions, conversionRate, activeBooths', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(8)   // APPROVED
      .mockResolvedValueOnce(1)   // EXPIRED
      .mockResolvedValueOnce(1);  // REJECTED
    mockPrisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: 120 } });
    mockPrisma.photoSession.count.mockResolvedValueOnce(8);
    mockBoothGateway.getOnlineBoothCount.mockReturnValue(3);

    const result = await controller.getMetrics(TENANT_USER as any);

    expect(result.totalRevenue).toBe(120);
    expect(result.totalSessions).toBe(8);
    expect(result.conversionRate).toBe(80);
    expect(result.activeBooths).toBe(3);
  });

  it('returns conversionRate 0 when no resolved payments', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.payment.aggregate.mockResolvedValueOnce({ _sum: { amount: null } });
    mockPrisma.photoSession.count.mockResolvedValueOnce(0);
    mockBoothGateway.getOnlineBoothCount.mockReturnValue(0);

    const result = await controller.getMetrics(TENANT_USER as any);

    expect(result.conversionRate).toBe(0);
    expect(result.activeBooths).toBe(0);
  });
});

describe('TenantController — booths', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('GET /tenant/booths returns booths with isOnline flag', async () => {
    mockPrisma.booth.findMany.mockResolvedValueOnce([
      { id: 'b-1', name: 'Booth 1', token: 'tok', tenantId: 'tenant-1', offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    mockBoothGateway.isBoothOnline.mockReturnValue(true);

    const result = await controller.getBooths(TENANT_USER as any);

    expect(result).toHaveLength(1);
    expect(result[0].isOnline).toBe(true);
    expect(result[0].id).toBe('b-1');
  });

  it('POST /tenant/booths creates booth with generated token', async () => {
    const created = { id: 'b-new', name: 'New Booth', token: 'generated', tenantId: 'tenant-1', offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true, createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.booth.create.mockResolvedValueOnce(created);

    const result = await controller.createBooth({ name: 'New Booth', offlineMode: 'BLOCK' }, TENANT_USER as any);

    expect(mockPrisma.booth.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'New Booth', tenantId: 'tenant-1' }),
    });
    expect(result.id).toBe('b-new');
  });
});

describe('TenantController — gallery', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns paginated gallery sessions', async () => {
    const sessions = [
      {
        id: 'sess-1',
        photoUrls: ['https://s3.example.com/photo.jpg'],
        createdAt: new Date('2026-01-01'),
        event: { name: 'Wedding' },
        booth: { name: 'Booth 1' },
      },
    ];
    mockPrisma.photoSession.findMany.mockResolvedValueOnce(sessions);
    mockPrisma.photoSession.count.mockResolvedValueOnce(1);

    const result = await controller.getPhotos(TENANT_USER as any, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].sessionId).toBe('sess-1');
    expect(result.data[0].eventName).toBe('Wedding');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});

describe('TenantController — payments', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns paginated payment records', async () => {
    const payments = [
      {
        id: 'pay-1',
        amount: { toNumber: () => 15 },
        status: 'APPROVED',
        createdAt: new Date('2026-01-01'),
        event: { name: 'Wedding' },
        booth: { name: 'Booth 1' },
      },
    ];
    mockPrisma.payment.findMany.mockResolvedValueOnce(payments);
    mockPrisma.payment.count.mockResolvedValueOnce(1);

    const result = await controller.getPayments(TENANT_USER as any, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('pay-1');
    expect(result.data[0].eventName).toBe('Wedding');
    expect(result.total).toBe(1);
  });
});

describe('TenantController — settings', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('GET /tenant/settings returns branding fields', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      logoUrl: 'https://logo.png', primaryColor: '#1d4ed8', brandName: 'MyBrand',
    });

    const result = await controller.getSettings(TENANT_USER as any);

    expect(result.logoUrl).toBe('https://logo.png');
    expect(result.primaryColor).toBe('#1d4ed8');
    expect(result.brandName).toBe('MyBrand');
  });

  it('GET /tenant/settings throws NotFoundException when tenant not found', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(controller.getSettings(TENANT_USER as any)).rejects.toThrow(NotFoundException);
  });

  it('PUT /tenant/settings updates and returns branding fields', async () => {
    const updated = { logoUrl: null, primaryColor: '#ff0000', brandName: 'Updated' };
    mockPrisma.tenant.update.mockResolvedValueOnce(updated);

    const result = await controller.updateSettings({ primaryColor: '#ff0000', brandName: 'Updated' }, TENANT_USER as any);

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { primaryColor: '#ff0000', brandName: 'Updated' },
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
    expect(result.primaryColor).toBe('#ff0000');
  });
});
