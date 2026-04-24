import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from '../crypto/token-crypto.service';
import axios from 'axios';

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
}

@Injectable()
export class MpOAuthService {
  private readonly logger = new Logger(MpOAuthService.name);
  private readonly clientId = process.env.MP_CLIENT_ID!;
  private readonly clientSecret = process.env.MP_CLIENT_SECRET!;
  private readonly redirectUri = process.env.MP_OAUTH_REDIRECT_URI!;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly crypto: TokenCryptoService,
  ) {}

  buildAuthorizationUrl(tenantId: string): string {
    const state = this.jwt.sign(
      { tenantId, nonce: Math.random().toString(36).slice(2) },
      { expiresIn: '10m' },
    );
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: this.redirectUri,
      state,
    });
    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<string> {
    let tenantId: string;
    try {
      const payload = this.jwt.verify(state) as { tenantId: string };
      tenantId = payload.tenantId;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }

    const tokens = await this.exchangeCode(code);
    const email = await this.fetchEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        mpAccessToken: this.crypto.encrypt(tokens.access_token),
        mpRefreshToken: this.crypto.encrypt(tokens.refresh_token),
        mpUserId: tokens.user_id.toString(),
        mpEmail: email,
        mpTokenExpiresAt: expiresAt,
        mpConnectedAt: new Date(),
      },
    });

    this.logger.log(`MP OAuth connected for tenant ${tenantId} (user ${tokens.user_id})`);
    return tenantId;
  }

  async refreshIfNeeded(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { mpAccessToken: true, mpRefreshToken: true, mpTokenExpiresAt: true },
    });
    if (!tenant?.mpAccessToken || !tenant.mpRefreshToken) {
      throw new Error('No MP credentials for tenant');
    }

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (tenant.mpTokenExpiresAt && tenant.mpTokenExpiresAt > sevenDaysFromNow) {
      return this.crypto.decrypt(tenant.mpAccessToken);
    }

    this.logger.log(`Refreshing MP token for tenant ${tenantId}`);
    const refreshToken = this.crypto.decrypt(tenant.mpRefreshToken);
    const tokens = await this.exchangeRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        mpAccessToken: this.crypto.encrypt(tokens.access_token),
        mpRefreshToken: this.crypto.encrypt(tokens.refresh_token),
        mpTokenExpiresAt: expiresAt,
      },
    });

    return tokens.access_token;
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpUserId: null,
        mpEmail: null,
        mpTokenExpiresAt: null,
        mpConnectedAt: null,
      },
    });
  }

  private async exchangeCode(code: string): Promise<MpTokenResponse> {
    const res = await axios.post<MpTokenResponse>('https://api.mercadopago.com/oauth/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });
    return res.data;
  }

  private async exchangeRefreshToken(refreshToken: string): Promise<MpTokenResponse> {
    const res = await axios.post<MpTokenResponse>('https://api.mercadopago.com/oauth/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return res.data;
  }

  private async fetchEmail(accessToken: string): Promise<string> {
    try {
      const res = await axios.get<{ email: string }>('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data.email;
    } catch {
      return '';
    }
  }
}
