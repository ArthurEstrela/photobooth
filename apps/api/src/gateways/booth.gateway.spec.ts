import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BoothGateway } from './booth.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from './dashboard.gateway';

const mockJwt = { verify: jest.fn() };
const mockPrisma = { booth: { findUnique: jest.fn() } };
const mockDashboard = { broadcastToTenant: jest.fn() };

function makeClient(token: string, socketId = 'socket-abc') {
  return {
    id: socketId,
    data: {} as Record<string, any>,
    handshake: { headers: { authorization: `Bearer ${token}` } },
    disconnect: jest.fn(),
  };
}

const VALID_PAYLOAD = { sub: 'booth-1', tenantId: 'tenant-1', role: 'booth' };

describe('BoothGateway', () => {
  let gateway: BoothGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoothGateway,
        { provide: JwtService, useValue: mockJwt },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DashboardGateway, useValue: mockDashboard },
      ],
    }).compile();

    gateway = module.get<BoothGateway>(BoothGateway);
    jest.clearAllMocks();
    // Default: booth has no hardware config to sync
    mockPrisma.booth.findUnique.mockResolvedValue({ id: 'booth-1', selectedCamera: null, selectedPrinter: null });
  });

  describe('handleConnection', () => {
    it('registers booth when JWT is valid', async () => {
      mockJwt.verify.mockReturnValue(VALID_PAYLOAD);
      const client = makeClient('valid-jwt');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).not.toHaveBeenCalled();
      expect(gateway.isBoothOnline('booth-1')).toBe(true);
    });

    it('disconnects when JWT is invalid', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      const client = makeClient('bad-token');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
      expect(gateway.isBoothOnline('booth-1')).toBe(false);
    });

    it('disconnects when role is not booth', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', tenantId: 'tenant-1', role: 'user' });
      const client = makeClient('user-jwt');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('disconnects when Authorization header is absent', async () => {
      const client = {
        id: 'sock-1',
        data: {},
        handshake: { headers: {} },
        disconnect: jest.fn(),
      };
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('removes booth from map on disconnect', async () => {
      mockJwt.verify.mockReturnValue(VALID_PAYLOAD);
      const client = makeClient('valid-jwt', 'socket-xyz');
      await gateway.handleConnection(client as any);
      expect(gateway.isBoothOnline('booth-1')).toBe(true);

      gateway.handleDisconnect(client as any);
      expect(gateway.isBoothOnline('booth-1')).toBe(false);
    });
  });

  describe('isBoothOnline', () => {
    it('returns false for unknown boothId', () => {
      expect(gateway.isBoothOnline('unknown')).toBe(false);
    });
  });

  describe('getOnlineBoothCount', () => {
    it('returns 0 when no booths are connected for tenant', () => {
      expect(gateway.getOnlineBoothCount('tenant-nobody')).toBe(0);
    });

    it('counts only booths for the given tenant', async () => {
      mockJwt.verify.mockReturnValue(VALID_PAYLOAD);
      await gateway.handleConnection(makeClient('t1', 'sock-1') as any);
      expect(gateway.getOnlineBoothCount('tenant-1')).toBe(1);
      expect(gateway.getOnlineBoothCount('tenant-other')).toBe(0);
    });
  });

  describe('booth_status broadcast', () => {
    it('broadcasts booth_status online when booth connects', async () => {
      mockJwt.verify.mockReturnValue(VALID_PAYLOAD);
      await gateway.handleConnection(makeClient('valid-jwt') as any);
      expect(mockDashboard.broadcastToTenant).toHaveBeenCalledWith(
        'tenant-1', 'booth_status', { boothId: 'booth-1', online: true },
      );
    });

    it('broadcasts booth_status offline when booth disconnects', async () => {
      mockJwt.verify.mockReturnValue(VALID_PAYLOAD);
      const client = makeClient('valid-jwt');
      await gateway.handleConnection(client as any);
      jest.clearAllMocks();
      gateway.handleDisconnect(client as any);
      expect(mockDashboard.broadcastToTenant).toHaveBeenCalledWith(
        'tenant-1', 'booth_status', { boothId: 'booth-1', online: false },
      );
    });
  });
});
