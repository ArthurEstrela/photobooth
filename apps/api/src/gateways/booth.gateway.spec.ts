import { Test, TestingModule } from '@nestjs/testing';
import { BoothGateway } from './booth.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from './dashboard.gateway';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
  },
};

function makeClient(boothId: string, token: string, socketId = 'socket-abc') {
  return {
    id: socketId,
    handshake: {
      query: { boothId },
      headers: { authorization: `Bearer ${token}` },
    },
    disconnect: jest.fn(),
  };
}

describe('BoothGateway', () => {
  let gateway: BoothGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoothGateway,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DashboardGateway, useValue: { broadcastToTenant: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<BoothGateway>(BoothGateway);
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('deve registrar cabine com token válido', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'valid-token' });
      const client = makeClient('booth-1', 'valid-token');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('deve desconectar cabine com token inválido', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue(null);
      const client = makeClient('booth-1', 'bad-token');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('deve desconectar se boothId estiver ausente', async () => {
      const client = makeClient('', 'some-token');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('deve desconectar se Authorization header estiver ausente', async () => {
      const client = {
        id: 'socket-1',
        handshake: { query: { boothId: 'booth-1' }, headers: {} },
        disconnect: jest.fn(),
      };
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('deve remover cabine do mapa ao desconectar', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'valid-token', tenantId: 'tenant-1' });
      const client = makeClient('booth-1', 'valid-token', 'socket-xyz');
      await gateway.handleConnection(client as any);
      gateway.handleDisconnect(client as any);

      const serverMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      (gateway as any).server = serverMock;
      gateway.sendPaymentApproved('booth-1', {});
      expect(serverMock.to).not.toHaveBeenCalled();
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
  });

  describe('booth_status broadcast on connect', () => {
    it('broadcasts booth_status online when booth connects', async () => {
      const mockDashboard = gateway['dashboardGateway'] as unknown as { broadcastToTenant: jest.Mock };
      const mockPrismaLocal = gateway['prisma'] as unknown as { booth: { findFirst: jest.Mock } };
      mockPrismaLocal.booth.findFirst.mockResolvedValueOnce({
        id: 'booth-1', token: 'tok', tenantId: 'tenant-1',
      });
      const client = {
        id: 'sock-1',
        handshake: { query: { boothId: 'booth-1' }, headers: { authorization: 'Bearer tok' } },
        disconnect: jest.fn(),
      };
      await gateway.handleConnection(client as any);
      expect(mockDashboard.broadcastToTenant).toHaveBeenCalledWith(
        'tenant-1', 'booth_status', { boothId: 'booth-1', online: true }
      );
    });
  });
});
