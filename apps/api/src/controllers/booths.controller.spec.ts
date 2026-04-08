import { Test, TestingModule } from '@nestjs/testing';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { OfflineMode } from '@packages/shared';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
  },
  event: {
    findFirst: jest.fn(),
  },
};

describe('BoothsController', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get<BoothsController>(BoothsController);
  });

  describe('GET /booths/:id/config', () => {
    it('returns BoothConfigDto for valid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({
        id: 'booth-1',
        token: 'secret',
        offlineMode: 'BLOCK',
        offlineCredits: 0,
        demoSessionsPerHour: 3,
        cameraSound: true,
        tenant: { logoUrl: null, primaryColor: '#3b82f6', brandName: 'Demo' },
      });

      const result = await controller.getConfig('booth-1', 'Bearer secret');

      expect(result.offlineMode).toBe(OfflineMode.BLOCK);
      expect(result.cameraSound).toBe(true);
      expect(result.branding.primaryColor).toBe('#3b82f6');
    });

    it('throws UnauthorizedException for invalid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue(null);
      await expect(controller.getConfig('booth-1', 'Bearer wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when auth header is missing', async () => {
      await expect(controller.getConfig('booth-1', undefined as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GET /booths/:id/event', () => {
    it('returns event with templates for valid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({
        id: 'booth-1',
        token: 'secret',
        tenantId: 'tenant-1',
      });
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        name: 'Casamento',
        price: { toNumber: () => 25.0 },
        photoCount: 2,
        templates: [{ id: 't1', name: 'Rosa', overlayUrl: '/frames/rosa.png', eventId: 'event-1', createdAt: new Date(), updatedAt: new Date() }],
      });

      const result = await controller.getBoothEvent('booth-1', 'Bearer secret');

      expect(result.event.photoCount).toBe(2);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('Rosa');
    });

    it('throws NotFoundException when no event exists for tenant', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'secret', tenantId: 'tenant-1' });
      mockPrisma.event.findFirst.mockResolvedValue(null);
      await expect(controller.getBoothEvent('booth-1', 'Bearer secret')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException for invalid token in getBoothEvent', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue(null);
      await expect(controller.getBoothEvent('booth-1', 'Bearer wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
