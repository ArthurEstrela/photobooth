import { Test, TestingModule } from '@nestjs/testing';
import { MpOAuthController } from './mp-oauth.controller';
import { MpOAuthService } from './mp-oauth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockMpOAuth = {
  buildAuthorizationUrl: jest.fn(),
  handleCallback: jest.fn(),
};

describe('MpOAuthController', () => {
  let controller: MpOAuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MpOAuthController],
      providers: [{ provide: MpOAuthService, useValue: mockMpOAuth }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MpOAuthController>(MpOAuthController);
    jest.clearAllMocks();
    delete process.env.DASHBOARD_URL;
  });

  describe('connect', () => {
    it('returns the MP authorization URL', () => {
      mockMpOAuth.buildAuthorizationUrl.mockReturnValue('https://auth.mercadopago.com/authorization?...');
      const req = { user: { tenantId: 'tenant-1' } } as any;
      const result = controller.connect(req);
      expect(result).toEqual({ url: 'https://auth.mercadopago.com/authorization?...' });
      expect(mockMpOAuth.buildAuthorizationUrl).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('callback', () => {
    it('redirects to dashboard/settings?mp=connected on success', async () => {
      mockMpOAuth.handleCallback.mockResolvedValue('tenant-1');
      const res = { redirect: jest.fn() } as any;
      await controller.callback('code123', 'state123', res);
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/settings?mp=connected');
    });

    it('redirects to settings?mp=error when handleCallback throws', async () => {
      mockMpOAuth.handleCallback.mockRejectedValue(new Error('invalid state'));
      const res = { redirect: jest.fn() } as any;
      await controller.callback('code', 'bad', res);
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:5173/settings?mp=error');
    });

    it('uses DASHBOARD_URL env var when set', async () => {
      process.env.DASHBOARD_URL = 'https://dashboard.example.com';
      mockMpOAuth.handleCallback.mockResolvedValue('tenant-1');
      const res = { redirect: jest.fn() } as any;
      await controller.callback('code', 'state', res);
      expect(res.redirect).toHaveBeenCalledWith('https://dashboard.example.com/settings?mp=connected');
    });
  });
});
