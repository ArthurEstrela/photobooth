import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from '../auth/admin.guard';

const mockPrisma = {
  tenant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn() };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  describe('GET /admin/tenants', () => {
    it('returns mapped tenant list with mpConnected and boothCount', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        {
          id: 't1',
          name: 'Foto Express',
          email: 'foto@express.com',
          createdAt: new Date('2026-01-01'),
          mpAccessToken: 'enc:sometoken',
          _count: { booths: 3 },
        },
        {
          id: 't2',
          name: 'Studio XYZ',
          email: 'studio@xyz.com',
          createdAt: new Date('2026-02-01'),
          mpAccessToken: null,
          _count: { booths: 1 },
        },
      ]);

      const result = await controller.getTenants();

      expect(result).toEqual([
        { id: 't1', name: 'Foto Express', email: 'foto@express.com', createdAt: new Date('2026-01-01'), mpConnected: true, boothCount: 3 },
        { id: 't2', name: 'Studio XYZ', email: 'studio@xyz.com', createdAt: new Date('2026-02-01'), mpConnected: false, boothCount: 1 },
      ]);
    });
  });

  describe('POST /admin/impersonate/:tenantId', () => {
    it('throws NotFoundException for unknown tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(controller.impersonate('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns tenant JWT with impersonated: true in payload', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', email: 'foto@express.com' });
      mockJwt.sign.mockReturnValue('tenant-impersonation-jwt');

      const result = await controller.impersonate('t1');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        { sub: 't1', email: 'foto@express.com', impersonated: true },
        { expiresIn: '7d' },
      );
      expect(result).toEqual({ token: 'tenant-impersonation-jwt', tenantId: 't1', email: 'foto@express.com' });
    });
  });
});
