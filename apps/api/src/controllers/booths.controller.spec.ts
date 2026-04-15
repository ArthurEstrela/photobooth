import { Test } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockBooth = {
  id: 'booth-1',
  token: 'tok',
  tenantId: 'tenant-1',
  offlineMode: 'BLOCK',
  offlineCredits: 0,
  demoSessionsPerHour: 3,
  cameraSound: true,
  activeEventId: null,
  selectedCamera: 'Logitech C920',
  selectedPrinter: 'DNP RX1',
  maintenancePin: 'abc123hash',
  tenant: { logoUrl: null, primaryColor: null, brandName: 'Test' },
};

const prismaMock = {
  booth: { findFirst: jest.fn().mockResolvedValue(mockBooth) },
};

describe('BoothsController.getConfig', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();
    controller = module.get(BoothsController);
  });

  it('includes devices in config response', async () => {
    const result = await controller.getConfig('booth-1', 'Bearer tok');
    expect(result.devices).toEqual({
      selectedCamera: 'Logitech C920',
      selectedPrinter: 'DNP RX1',
      maintenancePin: 'abc123hash',
    });
  });
});

const mockPrisma = {
  booth: { findFirst: jest.fn(), findUnique: jest.fn() },
  event: { findUnique: jest.fn() },
};

describe('BoothsController — getBoothEvent', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get(BoothsController);
  });

  it('throws UnauthorizedException when no token', async () => {
    await expect(controller.getBoothEvent('b-1', undefined as any)).rejects.toThrow(UnauthorizedException);
  });

  it('throws NotFoundException when booth has no activeEventId', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'b-1', token: 'tok', activeEventId: null });

    await expect(controller.getBoothEvent('b-1', 'Bearer tok')).rejects.toThrow(NotFoundException);
  });

  it('returns event with ordered templates when activeEventId is set', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'b-1', token: 'tok', activeEventId: 'ev-1' });
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'ev-1', name: 'Wedding', price: { toNumber: () => 30 }, photoCount: 4,
      digitalPrice: { toNumber: () => 5 }, backgroundUrl: null, maxTemplates: 3,
      eventTemplates: [
        { order: 0, template: { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png' } },
        { order: 1, template: { id: 't-2', name: 'Gold', overlayUrl: 'https://s3/t2.png' } },
      ],
    });

    const result = await controller.getBoothEvent('b-1', 'Bearer tok');

    expect(result.event.digitalPrice).toBe(5);
    expect(result.event.maxTemplates).toBe(3);
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0].id).toBe('t-1');
    expect(result.templates[0].order).toBe(0);
  });
});
