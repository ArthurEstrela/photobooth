import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DashboardGateway } from './dashboard.gateway';

const mockJwtService = { verify: jest.fn() };
const mockServer = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

function makeClient(token: string) {
  return {
    id: 'socket-1',
    handshake: { auth: { token } },
    join: jest.fn(),
    disconnect: jest.fn(),
    data: {} as Record<string, unknown>,
  };
}

describe('DashboardGateway', () => {
  let gateway: DashboardGateway;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DashboardGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    gateway = module.get(DashboardGateway);
    (gateway as any).server = mockServer;
  });

  describe('handleConnection', () => {
    it('disconnects when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('bad'); });
      const client = makeClient('bad-token');
      await gateway.handleConnection(client as any);
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins tenant room when token is valid', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'tenant-1', email: 'a@b.com' });
      const client = makeClient('good-token');
      await gateway.handleConnection(client as any);
      expect(client.join).toHaveBeenCalledWith('tenant:tenant-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToTenant', () => {
    it('emits event to tenant room', () => {
      gateway.broadcastToTenant('tenant-1', 'booth_status', { boothId: 'b-1', online: true });
      expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-1');
      expect(mockServer.emit).toHaveBeenCalledWith('booth_status', { boothId: 'b-1', online: true });
    });
  });
});
