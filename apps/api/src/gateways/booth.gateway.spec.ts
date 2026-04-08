import { Test, TestingModule } from '@nestjs/testing';
import { BoothGateway } from './booth.gateway';
import { PrismaService } from '../prisma/prisma.service';

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
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'valid-token' });
      const client = makeClient('booth-1', 'valid-token', 'socket-xyz');
      await gateway.handleConnection(client as any);
      gateway.handleDisconnect(client as any);

      const serverMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      (gateway as any).server = serverMock;
      gateway.sendPaymentApproved('booth-1', {});
      expect(serverMock.to).not.toHaveBeenCalled();
    });
  });
});
