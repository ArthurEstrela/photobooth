import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MpOAuthService } from './mp-oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from '../crypto/token-crypto.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockCrypto = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace('enc:', '')),
};

const MP_TOKEN_RESPONSE = {
  access_token: 'APP_USR-access-token',
  refresh_token: 'APP_USR-refresh-token',
  expires_in: 15552000,
  user_id: 123456,
};

describe('MpOAuthService', () => {
  let service: MpOAuthService;

  beforeEach(async () => {
    process.env.MP_CLIENT_ID = 'client-id';
    process.env.MP_CLIENT_SECRET = 'client-secret';
    process.env.MP_OAUTH_REDIRECT_URI = 'http://localhost:3000/auth/mp/callback';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpOAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: TokenCryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<MpOAuthService>(MpOAuthService);
    jest.clearAllMocks();
  });

  describe('buildAuthorizationUrl', () => {
    it('returns an MP authorization URL', () => {
      mockJwt.sign.mockReturnValue('signed.state.jwt');
      const url = service.buildAuthorizationUrl('tenant-1');
      expect(url).toContain('https://auth.mercadopago.com/authorization');
      expect(url).toContain('client_id=client-id');
      expect(url).toContain('state=signed.state.jwt');
    });

    it('signs JWT state with tenantId', () => {
      mockJwt.sign.mockReturnValue('jwt');
      service.buildAuthorizationUrl('tenant-abc');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-abc' }),
        expect.objectContaining({ expiresIn: '10m' }),
      );
    });
  });

  describe('handleCallback', () => {
    it('throws UnauthorizedException for invalid state JWT', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.handleCallback('code', 'bad-state')).rejects.toThrow(UnauthorizedException);
    });

    it('stores encrypted tokens on success', async () => {
      mockJwt.verify.mockReturnValue({ tenantId: 'tenant-1' });
      mockedAxios.post.mockResolvedValue({ data: MP_TOKEN_RESPONSE });
      mockedAxios.get.mockResolvedValue({ data: { email: 'owner@mp.com' } });
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.handleCallback('auth-code', 'valid-state');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: expect.objectContaining({
          mpAccessToken: 'enc:APP_USR-access-token',
          mpRefreshToken: 'enc:APP_USR-refresh-token',
          mpUserId: '123456',
          mpEmail: 'owner@mp.com',
        }),
      });
    });

    it('stores empty string email when fetchEmail fails', async () => {
      mockJwt.verify.mockReturnValue({ tenantId: 'tenant-1' });
      mockedAxios.post.mockResolvedValue({ data: MP_TOKEN_RESPONSE });
      mockedAxios.get.mockRejectedValue(new Error('network error'));
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.handleCallback('auth-code', 'valid-state');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mpEmail: '' }),
        }),
      );
    });
  });

  describe('refreshIfNeeded', () => {
    it('throws when tenant has no MP credentials', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ mpAccessToken: null, mpRefreshToken: null });
      await expect(service.refreshIfNeeded('tenant-1')).rejects.toThrow('No MP credentials');
    });

    it('refreshes when mpTokenExpiresAt is null (treats as expired)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        mpAccessToken: 'enc:APP_USR-token',
        mpRefreshToken: 'enc:APP_USR-rtoken',
        mpTokenExpiresAt: null,
      });
      mockedAxios.post.mockResolvedValue({ data: { ...MP_TOKEN_RESPONSE, access_token: 'refreshed-token' } });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.refreshIfNeeded('tenant-1');
      expect(result).toBe('refreshed-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.mercadopago.com/oauth/token',
        expect.objectContaining({ grant_type: 'refresh_token' }),
      );
    });

    it('returns decrypted access token when token is fresh (>7d)', async () => {
      const freshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      mockPrisma.tenant.findUnique.mockResolvedValue({
        mpAccessToken: 'enc:APP_USR-token',
        mpRefreshToken: 'enc:APP_USR-rtoken',
        mpTokenExpiresAt: freshExpiry,
      });

      const result = await service.refreshIfNeeded('tenant-1');
      expect(result).toBe('APP_USR-token');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('refreshes token when expiry is within 7 days', async () => {
      const soonExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      mockPrisma.tenant.findUnique.mockResolvedValue({
        mpAccessToken: 'enc:old-token',
        mpRefreshToken: 'enc:APP_USR-rtoken',
        mpTokenExpiresAt: soonExpiry,
      });
      mockedAxios.post.mockResolvedValue({ data: { ...MP_TOKEN_RESPONSE, access_token: 'new-token' } });
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await service.refreshIfNeeded('tenant-1');
      expect(result).toBe('new-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.mercadopago.com/oauth/token',
        expect.objectContaining({ grant_type: 'refresh_token' }),
      );
    });
  });

  describe('disconnect', () => {
    it('clears all MP fields', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});
      await service.disconnect('tenant-1');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          mpAccessToken: null,
          mpRefreshToken: null,
          mpUserId: null,
          mpEmail: null,
          mpTokenExpiresAt: null,
          mpConnectedAt: null,
        },
      });
    });
  });
});
