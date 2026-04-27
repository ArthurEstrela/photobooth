import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from '../gateways/dashboard.gateway';
import { BoothJwtGuard } from '../guards/booth-jwt.guard';
import { GeneratePairingCodeUseCase } from '../use-cases/generate-pairing-code.use-case';
import { PairBoothUseCase } from '../use-cases/pair-booth.use-case';

const mockBooth = {
  id: 'booth-1',
  tenantId: 'tenant-1',
  offlineMode: 'BLOCK',
  offlineCredits: 0,
  demoSessionsPerHour: 3,
  cameraSound: true,
  activeEventId: null,
  selectedCamera: 'Logitech C920',
  selectedPrinter: 'DNP RX1',
  maintenancePin: 'abc123hash',
  pairedAt: null,
  tenant: {
    logoUrl: null,
    primaryColor: null,
    brandName: 'Test',
    subscriptionStatus: 'ACTIVE',
  },
};

const prismaMock = {
  booth: {
    findFirst: jest.fn().mockResolvedValue(mockBooth),
    update: jest.fn().mockResolvedValue(mockBooth),
  },
  event: { findUnique: jest.fn() },
};

const dashboardGatewayMock = {
  broadcastToTenant: jest.fn(),
};

const generatePairingCodeMock = {
  execute: jest.fn().mockResolvedValue({ code: 'ABC123', expiresAt: new Date() }),
};

const pairBoothMock = {
  execute: jest.fn().mockResolvedValue({ boothId: 'booth-1', token: 'jwt-token' }),
};

async function buildModule() {
  const module = await Test.createTestingModule({
    controllers: [BoothsController],
    providers: [
      { provide: PrismaService, useValue: prismaMock },
      { provide: DashboardGateway, useValue: dashboardGatewayMock },
      { provide: GeneratePairingCodeUseCase, useValue: generatePairingCodeMock },
      { provide: PairBoothUseCase, useValue: pairBoothMock },
    ],
  })
    .overrideGuard(BoothJwtGuard)
    .useValue({ canActivate: () => true })
    .compile();

  return module.get(BoothsController);
}

describe('BoothsController.getConfig', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.booth.findFirst.mockResolvedValue(mockBooth);
    controller = await buildModule();
  });

  it('includes devices in config response', async () => {
    const result = await controller.getConfig('booth-1');
    expect(result.devices).toEqual({
      selectedCamera: 'Logitech C920',
      selectedPrinter: 'DNP RX1',
      maintenancePin: 'abc123hash',
    });
  });
});

describe('BoothsController — getBoothEvent', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildModule();
  });

  it('throws NotFoundException when booth has no activeEventId', async () => {
    prismaMock.booth.findFirst.mockResolvedValue({ id: 'b-1', tenantId: 'tenant-1', activeEventId: null });

    await expect(controller.getBoothEvent('b-1')).rejects.toThrow(NotFoundException);
  });

  it('returns event with ordered templates when activeEventId is set', async () => {
    prismaMock.booth.findFirst.mockResolvedValue({ id: 'b-1', tenantId: 'tenant-1', activeEventId: 'ev-1' });
    prismaMock.event.findUnique.mockResolvedValue({
      id: 'ev-1', name: 'Wedding', price: { toNumber: () => 30 }, photoCount: 4,
      digitalPrice: { toNumber: () => 5 }, backgroundUrl: null, maxTemplates: 3,
      eventTemplates: [
        { order: 0, template: { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', photoCount: null, layout: null } },
        { order: 1, template: { id: 't-2', name: 'Gold', overlayUrl: 'https://s3/t2.png', photoCount: null, layout: null } },
      ],
    });

    const result = await controller.getBoothEvent('b-1');

    expect(result.event.digitalPrice).toBe(5);
    expect(result.event.maxTemplates).toBe(3);
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0].id).toBe('t-1');
    expect(result.templates[0].order).toBe(0);
  });
});

describe('BoothsController — pair', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildModule();
  });

  it('calls pairBooth.execute with uppercased trimmed code', async () => {
    pairBoothMock.execute.mockResolvedValue({ boothId: 'booth-1', token: 'jwt-token' });
    const result = await controller.pair({ code: ' abc123 ' });
    expect(pairBoothMock.execute).toHaveBeenCalledWith('ABC123');
    expect(result).toEqual({ boothId: 'booth-1', token: 'jwt-token' });
  });
});

describe('BoothsController — unpair', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = await buildModule();
  });

  it('clears pairedAt and broadcasts booth_unpaired', async () => {
    prismaMock.booth.update.mockResolvedValue({});
    const req = { user: { sub: 'booth-1', tenantId: 'tenant-1', role: 'booth' } };
    const result = await controller.unpair(req as any);
    expect(prismaMock.booth.update).toHaveBeenCalledWith({
      where: { id: 'booth-1' },
      data: { pairedAt: null },
    });
    expect(dashboardGatewayMock.broadcastToTenant).toHaveBeenCalledWith('tenant-1', 'booth_unpaired', { boothId: 'booth-1' });
    expect(result).toEqual({ ok: true });
  });
});
