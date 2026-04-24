# Mercado Pago OAuth Per-Tenant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each tenant connects their own Mercado Pago account via OAuth so payments fall into the correct account; tenants without a connected account are blocked from creating payments.

**Architecture:** Six new fields on `Tenant` store encrypted credentials. A `TokenCryptoService` handles AES-256-GCM. `MpOAuthService` owns the OAuth flow (connect, callback, refresh, disconnect). `MercadoPagoAdapter` accepts `accessToken` as a parameter instead of reading a global env var. Both payment use-cases look up the tenant's token before calling the adapter. The dashboard Settings page gains a "Mercado Pago" card with connect/disconnect UI.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Mercado Pago OAuth API, Node.js `crypto` module (AES-256-GCM), `@nestjs/jwt` (JWT state), axios, React + TanStack Query, Vitest (dashboard), Jest (API).

---

## File Map

| File | Action |
|---|---|
| `apps/api/prisma/schema.prisma` | Modify — add 6 MP fields to Tenant |
| `apps/api/src/crypto/token-crypto.service.ts` | Create |
| `apps/api/src/crypto/crypto.module.ts` | Create |
| `apps/api/src/crypto/token-crypto.service.spec.ts` | Create |
| `apps/api/src/auth/mp-oauth.service.ts` | Create |
| `apps/api/src/auth/mp-oauth.service.spec.ts` | Create |
| `apps/api/src/auth/mp-oauth.controller.ts` | Create |
| `apps/api/src/auth/mp-oauth.controller.spec.ts` | Create |
| `apps/api/src/app.module.ts` | Modify — add CryptoModule, MpOAuthService, MpOAuthController |
| `apps/api/src/adapters/mercadopago.adapter.ts` | Modify — accept `accessToken` param |
| `apps/api/src/use-cases/create-pix-payment.use-case.ts` | Modify — look up tenant token |
| `apps/api/src/use-cases/create-digital-payment.use-case.ts` | Modify — look up tenant token |
| `packages/shared/src/types.ts` | Modify — add `mp` field to `ITenantSettings` |
| `apps/api/src/controllers/tenant.controller.ts` | Modify — settings response + DELETE endpoint |
| `apps/dashboard/src/hooks/api/useSettings.ts` | Modify — add `useConnectMp`, `useDisconnectMp` |
| `apps/dashboard/src/pages/SettingsPage.tsx` | Modify — MP connection card |
| `apps/dashboard/src/pages/SettingsPage.test.tsx` | Modify — update mocks + add MP tests |

---

## Task 1: Prisma Schema — Add MP Fields to Tenant

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the 6 new fields to the Tenant model**

Open `apps/api/prisma/schema.prisma`. Add these lines after `brandName String?` in the `Tenant` model:

```prisma
  mpAccessToken    String?
  mpRefreshToken   String?
  mpUserId         String?
  mpEmail          String?
  mpTokenExpiresAt DateTime?
  mpConnectedAt    DateTime?
```

The full Tenant model should look like:

```prisma
model Tenant {
  id               String     @id @default(uuid())
  name             String
  email            String     @unique
  passwordHash     String
  logoUrl          String?
  primaryColor     String?
  brandName        String?
  mpAccessToken    String?
  mpRefreshToken   String?
  mpUserId         String?
  mpEmail          String?
  mpTokenExpiresAt DateTime?
  mpConnectedAt    DateTime?
  planId           String?
  plan             Plan?      @relation(fields: [planId], references: [id])
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  booths           Booth[]
  events           Event[]
  templates        Template[]
}
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api && npx prisma migrate dev --name add-mp-oauth-fields
```

Expected output:
```
Applying migration `..._add_mp_oauth_fields`
Your database is now in sync with your schema.
```

- [ ] **Step 3: Verify Prisma client was regenerated**

```bash
cd apps/api && npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add MP OAuth fields to Tenant schema"
```

---

## Task 2: TokenCryptoService — AES-256-GCM Encrypt/Decrypt

**Files:**
- Create: `apps/api/src/crypto/token-crypto.service.spec.ts`
- Create: `apps/api/src/crypto/token-crypto.service.ts`
- Create: `apps/api/src/crypto/crypto.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/crypto/token-crypto.service.spec.ts`:

```typescript
import { TokenCryptoService } from './token-crypto.service';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('TokenCryptoService', () => {
  let service: TokenCryptoService;

  beforeEach(() => {
    process.env.MP_TOKEN_ENCRYPTION_KEY = VALID_KEY;
    service = new TokenCryptoService();
  });

  afterEach(() => {
    delete process.env.MP_TOKEN_ENCRYPTION_KEY;
  });

  it('decrypt(encrypt(x)) returns original plaintext', () => {
    const plaintext = 'APP_USR-some-mp-access-token-12345';
    expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
  });

  it('each encrypt call produces a different ciphertext (random IV)', () => {
    const plaintext = 'APP_USR-token';
    expect(service.encrypt(plaintext)).not.toBe(service.encrypt(plaintext));
  });

  it('ciphertext has iv:tag:ciphertext format (3 colon-separated hex parts)', () => {
    const encrypted = service.encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/); // iv
    expect(parts[1]).toMatch(/^[0-9a-f]+$/); // tag
    expect(parts[2]).toMatch(/^[0-9a-f]+$/); // ciphertext
  });

  it('tampered auth tag throws on decrypt', () => {
    const encrypted = service.encrypt('test');
    const parts = encrypted.split(':');
    parts[1] = 'deadbeefdeadbeefdeadbeefdeadbeef'; // replace tag
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });

  it('throws on missing MP_TOKEN_ENCRYPTION_KEY', () => {
    delete process.env.MP_TOKEN_ENCRYPTION_KEY;
    expect(() => new TokenCryptoService()).toThrow('MP_TOKEN_ENCRYPTION_KEY');
  });

  it('throws on key with wrong length', () => {
    process.env.MP_TOKEN_ENCRYPTION_KEY = 'tooshort';
    expect(() => new TokenCryptoService()).toThrow('MP_TOKEN_ENCRYPTION_KEY');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=token-crypto --no-coverage
```

Expected: FAIL with "Cannot find module './token-crypto.service'"

- [ ] **Step 3: Implement TokenCryptoService**

Create `apps/api/src/crypto/token-crypto.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.MP_TOKEN_ENCRYPTION_KEY ?? '';
    if (hex.length !== 64) {
      throw new Error('MP_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(stored: string): string {
    const [ivHex, tagHex, encHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
```

- [ ] **Step 4: Create CryptoModule**

Create `apps/api/src/crypto/crypto.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TokenCryptoService } from './token-crypto.service';

@Module({
  providers: [TokenCryptoService],
  exports: [TokenCryptoService],
})
export class CryptoModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=token-crypto --no-coverage
```

Expected: PASS, 6 tests passing

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/crypto/
git commit -m "feat(api): add TokenCryptoService for AES-256-GCM token encryption"
```

---

## Task 3: MpOAuthService — OAuth Flow, Token Refresh, Disconnect

**Files:**
- Create: `apps/api/src/auth/mp-oauth.service.spec.ts`
- Create: `apps/api/src/auth/mp-oauth.service.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/auth/mp-oauth.service.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=mp-oauth.service --no-coverage
```

Expected: FAIL with "Cannot find module './mp-oauth.service'"

- [ ] **Step 3: Implement MpOAuthService**

Create `apps/api/src/auth/mp-oauth.service.ts`:

```typescript
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
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=mp-oauth.service --no-coverage
```

Expected: PASS, 8 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/mp-oauth.service.ts apps/api/src/auth/mp-oauth.service.spec.ts
git commit -m "feat(api): add MpOAuthService for per-tenant MP OAuth flow"
```

---

## Task 4: MpOAuthController — Connect and Callback Endpoints

**Files:**
- Create: `apps/api/src/auth/mp-oauth.controller.spec.ts`
- Create: `apps/api/src/auth/mp-oauth.controller.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/auth/mp-oauth.controller.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=mp-oauth.controller --no-coverage
```

Expected: FAIL with "Cannot find module './mp-oauth.controller'"

- [ ] **Step 3: Implement MpOAuthController**

Create `apps/api/src/auth/mp-oauth.controller.ts`:

```typescript
import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MpOAuthService } from './mp-oauth.service';

@Controller('auth/mp')
export class MpOAuthController {
  constructor(private readonly mpOAuth: MpOAuthService) {}

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: Request) {
    const tenantId = (req.user as any).tenantId;
    const url = this.mpOAuth.buildAuthorizationUrl(tenantId);
    return { url };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:5173';
    try {
      await this.mpOAuth.handleCallback(code, state);
      res.redirect(`${dashboardUrl}/settings?mp=connected`);
    } catch {
      res.redirect(`${dashboardUrl}/settings?mp=error`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=mp-oauth.controller --no-coverage
```

Expected: PASS, 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/mp-oauth.controller.ts apps/api/src/auth/mp-oauth.controller.spec.ts
git commit -m "feat(api): add MpOAuthController with connect and callback endpoints"
```

---

## Task 5: Wire CryptoModule, MpOAuthService, MpOAuthController into AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Update app.module.ts**

Replace the contents of `apps/api/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { MpOAuthController } from './auth/mp-oauth.controller';
import { MpOAuthService } from './auth/mp-oauth.service';
import { TenantController } from './controllers/tenant.controller';
import { EventController } from './controllers/event.controller';
import { BoothsController } from './controllers/booths.controller';
import { PaymentController } from './controllers/payment.controller';
import { PhotoController } from './controllers/photo.controller';
import { HealthController } from './controllers/health.controller';
import { BoothGateway } from './gateways/booth.gateway';
import { DashboardGateway } from './gateways/dashboard.gateway';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter';
import { CreatePixPaymentUseCase } from './use-cases/create-pix-payment.use-case';
import { CreateDigitalPaymentUseCase } from './use-cases/create-digital-payment.use-case';
import { ProcessWebhookUseCase } from './use-cases/process-webhook.use-case';
import { SyncPhotoUseCase } from './use-cases/sync-photo.use-case';
import { PaymentExpirationProcessor } from './workers/payment-expiration.processor';
import { S3StorageAdapter } from './adapters/storage/s3.adapter';
import { CryptoModule } from './crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    BullModule.forRoot({
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
    BullModule.registerQueue({
      name: 'payment-expiration',
    }),
    CryptoModule,
  ],
  controllers: [
    AuthController,
    MpOAuthController,
    TenantController,
    EventController,
    BoothsController,
    PaymentController,
    PhotoController,
    HealthController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    AuthService,
    JwtStrategy,
    MpOAuthService,
    BoothGateway,
    DashboardGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    CreateDigitalPaymentUseCase,
    ProcessWebhookUseCase,
    SyncPhotoUseCase,
    PaymentExpirationProcessor,
    S3StorageAdapter,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Run all API tests to confirm nothing broke**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All previously passing tests still pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): wire CryptoModule, MpOAuthService and MpOAuthController into AppModule"
```

---

## Task 6: MercadoPagoAdapter — Accept accessToken as Parameter

**Files:**
- Modify: `apps/api/src/adapters/mercadopago.adapter.ts`

The adapter currently has `private readonly accessToken = process.env.MP_ACCESS_TOKEN` and `createPixPayment(data)`. Change the signature to `createPixPayment(accessToken: string, data)` and remove the class field.

- [ ] **Step 1: Write a test to pin the new signature**

Create `apps/api/src/adapters/mercadopago.adapter.spec.ts`:

```typescript
import { MercadoPagoAdapter } from './mercadopago.adapter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MercadoPagoAdapter', () => {
  let adapter: MercadoPagoAdapter;

  beforeEach(() => {
    adapter = new MercadoPagoAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the provided accessToken in the Authorization header', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        id: 999,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'qr-string',
            qr_code_base64: 'base64-string',
          },
        },
        status: 'pending',
      },
    });

    await adapter.createPixPayment('MY_ACCESS_TOKEN', {
      amount: 50,
      description: 'Test',
      metadata: {},
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer MY_ACCESS_TOKEN',
        }),
      }),
    );
  });

  it('returns mock data in dev when MP API fails', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    mockedAxios.post.mockRejectedValue(new Error('network error'));

    const result = await adapter.createPixPayment('token', {
      amount: 10,
      description: 'Test',
      metadata: {},
    });

    expect(result.qrCode).toBeTruthy();
    expect(result.externalId).toBeTruthy();
    process.env.NODE_ENV = originalEnv;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=mercadopago.adapter --no-coverage
```

Expected: FAIL — `createPixPayment` does not accept `accessToken` as first arg

- [ ] **Step 3: Update MercadoPagoAdapter**

Replace the full contents of `apps/api/src/adapters/mercadopago.adapter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import axios from 'axios';

export interface MercadoPagoPixResponse {
  externalId: number;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
}

@Injectable()
export class MercadoPagoAdapter {
  private readonly logger = new Logger(MercadoPagoAdapter.name);
  private readonly apiUrl = 'https://api.mercadopago.com/v1';

  async createPixPayment(
    accessToken: string,
    data: { amount: number; description: string; metadata: any },
  ): Promise<MercadoPagoPixResponse> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/payments`,
        {
          transaction_amount: data.amount,
          description: data.description,
          payment_method_id: 'pix',
          payer: {
            email: process.env.MP_PAYER_EMAIL ?? 'cliente@photobooth.com.br',
          },
          ...(process.env.API_URL
            ? { notification_url: `${process.env.API_URL}/payments/webhook` }
            : {}),
          metadata: data.metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Idempotency-Key': randomUUID(),
          },
        },
      );

      const paymentData = response.data;
      return {
        externalId: paymentData.id,
        qrCode: paymentData.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
        status: paymentData.status,
      };
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn('⚠️ Mercado Pago API falhou. Retornando PIX MOCK de testes! ⚠️');
        return {
          externalId: Date.now(),
          qrCode: '00020101021243650016COM.BR.MOCK...',
          qrCodeBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAADElEQVQI12P4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC',
          status: 'PENDING',
        };
      }
      this.logger.error('Error creating MP Pix payment', error.response?.data || error.message);
      throw new Error('Failed to create Pix payment via Mercado Pago');
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=mercadopago.adapter --no-coverage
```

Expected: PASS, 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/adapters/mercadopago.adapter.ts apps/api/src/adapters/mercadopago.adapter.spec.ts
git commit -m "refactor(api): MercadoPagoAdapter accepts accessToken as parameter"
```

---

## Task 7: CreatePixPaymentUseCase — Tenant Token Lookup

**Files:**
- Modify: `apps/api/src/use-cases/create-pix-payment.use-case.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/use-cases/create-pix-payment.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreatePixPaymentUseCase } from './create-pix-payment.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrisma = {
  booth: { findUnique: jest.fn() },
  event: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
};

const mockAdapter = { createPixPayment: jest.fn() };
const mockMpOAuth = { refreshIfNeeded: jest.fn() };
const mockQueue = { add: jest.fn() };

const BOOTH = { id: 'booth-1', tenantId: 'tenant-1' };
const EVENT = { id: 'event-1', name: 'Festa' };
const MP_RESPONSE = { externalId: 111, qrCode: 'qr', qrCodeBase64: 'b64', status: 'pending' };
const PAYMENT = { id: 'pay-1', qrCode: 'qr', qrCodeBase64: 'b64' };

describe('CreatePixPaymentUseCase', () => {
  let useCase: CreatePixPaymentUseCase;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePixPaymentUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockAdapter },
        { provide: MpOAuthService, useValue: mockMpOAuth },
        { provide: getQueueToken('payment-expiration'), useValue: mockQueue },
      ],
    }).compile();

    useCase = module.get<CreatePixPaymentUseCase>(CreatePixPaymentUseCase);
    jest.clearAllMocks();
    mockPrisma.booth.findUnique.mockResolvedValue(BOOTH);
    mockPrisma.event.findUnique.mockResolvedValue(EVENT);
    mockAdapter.createPixPayment.mockResolvedValue(MP_RESPONSE);
    mockPrisma.payment.create.mockResolvedValue(PAYMENT);
    mockQueue.add.mockResolvedValue({});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.MP_ACCESS_TOKEN;
  });

  it('looks up tenant token and passes it to the adapter', async () => {
    mockMpOAuth.refreshIfNeeded.mockResolvedValue('APP_USR-tenant-token');

    await useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined });

    expect(mockMpOAuth.refreshIfNeeded).toHaveBeenCalledWith('tenant-1');
    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith(
      'APP_USR-tenant-token',
      expect.any(Object),
    );
  });

  it('throws BadRequestException when no MP token in production', async () => {
    process.env.NODE_ENV = 'production';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await expect(
      useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined }),
    ).rejects.toThrow(BadRequestException);
  });

  it('falls back to MP_ACCESS_TOKEN env var in dev when no tenant token', async () => {
    process.env.NODE_ENV = 'development';
    process.env.MP_ACCESS_TOKEN = 'DEV_TOKEN';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined });

    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('DEV_TOKEN', expect.any(Object));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=create-pix-payment --no-coverage
```

Expected: FAIL — `MpOAuthService` is not injected

- [ ] **Step 3: Update CreatePixPaymentUseCase**

Replace the full contents of `apps/api/src/use-cases/create-pix-payment.use-case.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { CreatePixPaymentDTO, PixPaymentResponse } from '@packages/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class CreatePixPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
    private readonly mpOAuth: MpOAuthService,
    @InjectQueue('payment-expiration') private readonly paymentQueue: Queue,
  ) {}

  async execute(dto: CreatePixPaymentDTO): Promise<PixPaymentResponse> {
    const booth = await this.prisma.booth.findUnique({ where: { id: dto.boothId } });
    if (!booth) throw new Error('Booth not found');

    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new Error('Event not found');

    let accessToken: string;
    try {
      accessToken = await this.mpOAuth.refreshIfNeeded(booth.tenantId);
    } catch {
      if (process.env.NODE_ENV !== 'production' && process.env.MP_ACCESS_TOKEN) {
        accessToken = process.env.MP_ACCESS_TOKEN;
      } else {
        throw new BadRequestException(
          'Conta Mercado Pago não conectada. Configure nas Configurações.',
        );
      }
    }

    const mpResponse = await this.mpAdapter.createPixPayment(accessToken, {
      amount: dto.amount,
      description: `Photo Session - ${event.name}`,
      metadata: { boothId: dto.boothId, eventId: dto.eventId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        externalId: mpResponse.externalId.toString(),
        amount: dto.amount,
        qrCode: mpResponse.qrCode,
        qrCodeBase64: mpResponse.qrCodeBase64,
        status: 'PENDING',
        boothId: dto.boothId,
        eventId: dto.eventId,
      },
    });

    await this.paymentQueue.add(
      'expire-payment',
      { paymentId: payment.id, boothId: dto.boothId },
      { delay: 2 * 60 * 1000 },
    );

    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 120,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=create-pix-payment --no-coverage
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/create-pix-payment.use-case.ts apps/api/src/use-cases/create-pix-payment.use-case.spec.ts
git commit -m "feat(api): CreatePixPaymentUseCase looks up per-tenant MP token"
```

---

## Task 8: CreateDigitalPaymentUseCase — Tenant Token Lookup

**Files:**
- Modify: `apps/api/src/use-cases/create-digital-payment.use-case.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/use-cases/create-digital-payment.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateDigitalPaymentUseCase } from './create-digital-payment.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { getQueueToken } from '@nestjs/bull';

const mockPrisma = {
  photoSession: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
};
const mockAdapter = { createPixPayment: jest.fn() };
const mockMpOAuth = { refreshIfNeeded: jest.fn() };
const mockQueue = { add: jest.fn() };

const SESSION = {
  id: 'session-1',
  boothId: 'booth-1',
  eventId: 'event-1',
  booth: { id: 'booth-1', tenantId: 'tenant-1' },
  event: { id: 'event-1', name: 'Festa', digitalPrice: { toNumber: () => 25 } },
};
const MP_RESPONSE = { externalId: 222, qrCode: 'qr', qrCodeBase64: 'b64', status: 'pending' };
const PAYMENT = { id: 'pay-2', qrCode: 'qr', qrCodeBase64: 'b64' };

describe('CreateDigitalPaymentUseCase', () => {
  let useCase: CreateDigitalPaymentUseCase;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDigitalPaymentUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockAdapter },
        { provide: MpOAuthService, useValue: mockMpOAuth },
        { provide: getQueueToken('payment-expiration'), useValue: mockQueue },
      ],
    }).compile();

    useCase = module.get<CreateDigitalPaymentUseCase>(CreateDigitalPaymentUseCase);
    jest.clearAllMocks();
    mockPrisma.photoSession.findUnique.mockResolvedValue(SESSION);
    mockAdapter.createPixPayment.mockResolvedValue(MP_RESPONSE);
    mockPrisma.payment.create.mockResolvedValue(PAYMENT);
    mockQueue.add.mockResolvedValue({});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.MP_ACCESS_TOKEN;
  });

  it('looks up tenant token and passes it to the adapter', async () => {
    mockMpOAuth.refreshIfNeeded.mockResolvedValue('APP_USR-tenant-token');

    await useCase.execute('session-1');

    expect(mockMpOAuth.refreshIfNeeded).toHaveBeenCalledWith('tenant-1');
    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('APP_USR-tenant-token', expect.any(Object));
  });

  it('throws BadRequestException when no MP token in production', async () => {
    process.env.NODE_ENV = 'production';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await expect(useCase.execute('session-1')).rejects.toThrow(BadRequestException);
  });

  it('falls back to MP_ACCESS_TOKEN env var in dev', async () => {
    process.env.NODE_ENV = 'development';
    process.env.MP_ACCESS_TOKEN = 'DEV_TOKEN';
    mockMpOAuth.refreshIfNeeded.mockRejectedValue(new Error('No MP credentials'));

    await useCase.execute('session-1');

    expect(mockAdapter.createPixPayment).toHaveBeenCalledWith('DEV_TOKEN', expect.any(Object));
  });

  it('throws NotFoundException when session does not exist', async () => {
    mockPrisma.photoSession.findUnique.mockResolvedValue(null);
    await expect(useCase.execute('bad-session')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=create-digital-payment --no-coverage
```

Expected: FAIL — `MpOAuthService` is not injected

- [ ] **Step 3: Update CreateDigitalPaymentUseCase**

Replace the full contents of `apps/api/src/use-cases/create-digital-payment.use-case.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';
import { MpOAuthService } from '../auth/mp-oauth.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PixPaymentResponse } from '@packages/shared';

@Injectable()
export class CreateDigitalPaymentUseCase {
  private readonly logger = new Logger(CreateDigitalPaymentUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
    private readonly mpOAuth: MpOAuthService,
    @InjectQueue('payment-expiration') private readonly paymentQueue: Queue,
  ) {}

  async execute(sessionId: string): Promise<PixPaymentResponse> {
    const session = await this.prisma.photoSession.findUnique({
      where: { id: sessionId },
      include: { event: true, booth: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!session.event.digitalPrice) {
      throw new BadRequestException('Digital download is free for this event');
    }

    let accessToken: string;
    try {
      accessToken = await this.mpOAuth.refreshIfNeeded(session.booth.tenantId);
    } catch {
      if (process.env.NODE_ENV !== 'production' && process.env.MP_ACCESS_TOKEN) {
        accessToken = process.env.MP_ACCESS_TOKEN;
      } else {
        throw new BadRequestException(
          'Conta Mercado Pago não conectada. Configure nas Configurações.',
        );
      }
    }

    const amount = session.event.digitalPrice.toNumber();
    const mpResponse = await this.mpAdapter.createPixPayment(accessToken, {
      amount,
      description: `Digital Download — ${session.event.name}`,
      metadata: { boothId: session.boothId, eventId: session.eventId, sessionId },
    });

    const payment = await this.prisma.payment.create({
      data: {
        externalId: mpResponse.externalId.toString(),
        amount,
        qrCode: mpResponse.qrCode,
        qrCodeBase64: mpResponse.qrCodeBase64,
        status: 'PENDING',
        paymentType: 'DIGITAL',
        boothId: session.boothId,
        eventId: session.eventId,
      },
    });

    await this.paymentQueue.add(
      'expire-payment',
      { paymentId: payment.id, boothId: session.boothId },
      { delay: 2 * 60 * 1000 },
    );

    this.logger.log(`Digital payment created: ${payment.id} for session ${sessionId}`);
    return {
      paymentId: payment.id,
      qrCode: mpResponse.qrCode,
      qrCodeBase64: mpResponse.qrCodeBase64,
      expiresIn: 120,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=create-digital-payment --no-coverage
```

Expected: PASS, 4 tests passing

- [ ] **Step 5: Run all API tests to confirm no regressions**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/use-cases/create-digital-payment.use-case.ts apps/api/src/use-cases/create-digital-payment.use-case.spec.ts
git commit -m "feat(api): CreateDigitalPaymentUseCase looks up per-tenant MP token"
```

---

## Task 9: Shared Type + Tenant Controller Settings Endpoints

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/api/src/controllers/tenant.controller.ts`

- [ ] **Step 1: Update ITenantSettings in shared types**

Open `packages/shared/src/types.ts`. Find `ITenantSettings` (around line 269) and replace it:

```typescript
export interface ITenantSettings {
  logoUrl: string | null;
  primaryColor: string | null;
  brandName: string | null;
  mp: {
    connected: boolean;
    email: string | null;
    connectedAt: Date | null;
  };
}
```

- [ ] **Step 2: Write a test for the updated tenant controller**

Open `apps/api/src/controllers/tenant.controller.spec.ts` and add these test cases at the end of the existing describe block (before the closing `}`):

```typescript
describe('getSettings', () => {
  it('returns mp.connected=true when mpAccessToken is set', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      logoUrl: null,
      primaryColor: '#4f46e5',
      brandName: 'Brand',
      mpAccessToken: 'enc:token',
      mpEmail: 'owner@mp.com',
      mpConnectedAt: new Date('2026-01-01'),
    });
    // controller is already set up in the describe block above
    const req = { user: { tenantId: 'tenant-1' } } as any;
    const result = await controller.getSettings(req);
    expect(result.mp.connected).toBe(true);
    expect(result.mp.email).toBe('owner@mp.com');
  });

  it('returns mp.connected=false when mpAccessToken is null', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      logoUrl: null,
      primaryColor: null,
      brandName: null,
      mpAccessToken: null,
      mpEmail: null,
      mpConnectedAt: null,
    });
    const req = { user: { tenantId: 'tenant-1' } } as any;
    const result = await controller.getSettings(req);
    expect(result.mp.connected).toBe(false);
    expect(result.mp.email).toBeNull();
  });
});

describe('disconnectMp', () => {
  it('calls mpOAuth.disconnect and returns { ok: true }', async () => {
    const req = { user: { tenantId: 'tenant-1' } } as any;
    const result = await controller.disconnectMp(req);
    expect(mockMpOAuth.disconnect).toHaveBeenCalledWith('tenant-1');
    expect(result).toEqual({ ok: true });
  });
});
```

You will need to modify the existing `apps/api/src/controllers/tenant.controller.spec.ts` to inject `MpOAuthService`. Add the following:

At the top of the file, add:
```typescript
import { MpOAuthService } from '../auth/mp-oauth.service';
```

Near the other mock objects at the top of the describe block, add:
```typescript
const mockMpOAuth = { disconnect: jest.fn() };
```

Inside the `Test.createTestingModule({ providers: [...] })` call, add:
```typescript
{ provide: MpOAuthService, useValue: mockMpOAuth },
```

Also add `mockMpOAuth.disconnect.mockResolvedValue(undefined)` inside `beforeEach` after `jest.clearAllMocks()`.

Then append the new test cases shown below to the existing describe block.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=tenant.controller --no-coverage
```

Expected: FAIL — new test cases reference methods not yet implemented

- [ ] **Step 4: Update TenantController**

In `apps/api/src/controllers/tenant.controller.ts`:

**Add import at top (after existing imports):**
```typescript
import { MpOAuthService } from '../auth/mp-oauth.service';
```

(Note: `Delete` is already imported in the existing file — do not add a duplicate.)

**Add `mpOAuth` to constructor:**
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly boothGateway: BoothGateway,
  private readonly s3: S3StorageAdapter,
  private readonly mpOAuth: MpOAuthService,
) {}
```

**Replace `getSettings` method:**
```typescript
@Get('settings')
async getSettings(@Request() req: AuthReq): Promise<ITenantSettings> {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
    select: {
      logoUrl: true,
      primaryColor: true,
      brandName: true,
      mpAccessToken: true,
      mpEmail: true,
      mpConnectedAt: true,
    },
  });
  if (!tenant) throw new NotFoundException('Tenant not found');
  return {
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    brandName: tenant.brandName,
    mp: {
      connected: !!tenant.mpAccessToken,
      email: tenant.mpEmail ?? null,
      connectedAt: tenant.mpConnectedAt ?? null,
    },
  };
}
```

**Add `disconnectMp` endpoint after `updateSettings`:**
```typescript
@Delete('settings/mp')
async disconnectMp(@Request() req: AuthReq) {
  await this.mpOAuth.disconnect(req.user.tenantId);
  return { ok: true };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=tenant.controller --no-coverage
```

Expected: PASS

- [ ] **Step 6: Run all API tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types.ts apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): tenant settings expose MP connection status; add DELETE /tenant/settings/mp"
```

---

## Task 10: Dashboard Settings UI — MP Connection Card

**Files:**
- Modify: `apps/dashboard/src/hooks/api/useSettings.ts`
- Modify: `apps/dashboard/src/pages/SettingsPage.tsx`
- Modify: `apps/dashboard/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `apps/dashboard/src/pages/SettingsPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

const mockDisconnectMp = vi.fn();
const mockConnectMp = vi.fn();

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: vi.fn(),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutate: vi.fn(), isPending: false, isError: false, reset: vi.fn() }),
  useConnectMp: () => ({ mutate: mockConnectMp, isPending: false }),
  useDisconnectMp: () => ({ mutate: mockDisconnectMp, isPending: false }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

import { useSettings } from '../hooks/api/useSettings';

const baseSettings = {
  logoUrl: null,
  primaryColor: '#4f46e5',
  brandName: 'MyBrand',
  mp: { connected: false, email: null, connectedAt: null },
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({
      data: baseSettings,
      isLoading: false,
    } as any);
    mockDisconnectMp.mockReset();
    mockConnectMp.mockReset();
  });

  it('renders brand name input with current value', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('MyBrand')).toBeTruthy();
  });

  it('renders color picker input with current color', () => {
    render(<SettingsPage />);
    const inputs = screen.getAllByDisplayValue('#4f46e5');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows MP section with connect button when not connected', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Mercado Pago')).toBeTruthy();
    expect(screen.getByText('Conectar Mercado Pago')).toBeTruthy();
  });

  it('shows connected state with email and disconnect button', () => {
    vi.mocked(useSettings).mockReturnValue({
      data: {
        ...baseSettings,
        mp: { connected: true, email: 'owner@mp.com', connectedAt: new Date('2026-01-01') },
      },
      isLoading: false,
    } as any);
    render(<SettingsPage />);
    expect(screen.getByText('owner@mp.com')).toBeTruthy();
    expect(screen.getByText('Desconectar')).toBeTruthy();
  });

  it('calls disconnectMp when disconnect button is clicked', async () => {
    vi.mocked(useSettings).mockReturnValue({
      data: {
        ...baseSettings,
        mp: { connected: true, email: 'owner@mp.com', connectedAt: new Date() },
      },
      isLoading: false,
    } as any);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Desconectar'));
    await waitFor(() => expect(mockDisconnectMp).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/pages/SettingsPage.test.tsx
```

Expected: FAIL — `useConnectMp`, `useDisconnectMp` not exported; MP section not rendered

- [ ] **Step 3: Update useSettings hook**

Replace the full contents of `apps/dashboard/src/hooks/api/useSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITenantSettings, UpdateTenantSettingsDto, ChangePasswordDto } from '@packages/shared';

export const useSettings = () =>
  useQuery<ITenantSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/settings');
      return data;
    },
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateTenantSettingsDto) => {
      const { data } = await api.put('/tenant/settings', body);
      return data as ITenantSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

export const useUploadLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/tenant/settings/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as { logoUrl: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (dto: ChangePasswordDto) => {
      await api.post('/auth/change-password', dto);
    },
  });

export const useConnectMp = () =>
  useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ url: string }>('/auth/mp/connect');
      window.location.href = data.url;
    },
  });

export const useDisconnectMp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete('/tenant/settings/mp');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};
```

- [ ] **Step 4: Update SettingsPage with MP card**

Replace the full contents of `apps/dashboard/src/pages/SettingsPage.tsx`:

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, Link2, Unlink } from 'lucide-react';
import { Card, Button, Input, Modal, Skeleton } from '../components/ui';
import {
  useSettings,
  useUpdateSettings,
  useUploadLogo,
  useChangePassword,
  useConnectMp,
  useDisconnectMp,
} from '../hooks/api/useSettings';
import { useAuth } from '../context/AuthContext';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function useOAuthToast() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mp = params.get('mp');
    if (mp === 'connected') {
      setToast({ type: 'success', message: 'Mercado Pago conectado com sucesso!' });
      params.delete('mp');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    } else if (mp === 'error') {
      setToast({ type: 'error', message: 'Erro ao conectar Mercado Pago. Tente novamente.' });
      params.delete('mp');
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`);
    }
  }, []);

  return { toast, clearToast: () => setToast(null) };
}

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const uploadLogo = useUploadLogo();
  const changePassword = useChangePassword();
  const connectMp = useConnectMp();
  const disconnectMp = useDisconnectMp();
  const { user } = useAuth();
  const { toast, clearToast } = useOAuthToast();

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brandName ?? '');
      setPrimaryColor(settings.primaryColor ?? '#4f46e5');
    }
  }, [settings]);

  useEffect(() => {
    try {
      const rgb = hexToRgb(primaryColor);
      document.documentElement.style.setProperty('--color-primary-rgb', rgb);
    } catch {}
  }, [primaryColor]);

  const handleSaveBranding = () => updateSettings.mutate({ brandName, primaryColor });

  const handleClosePasswordModal = () => {
    setPasswordOpen(false);
    setPwForm({ current: '', next: '', confirm: '' });
    setPwError(null);
    changePassword.reset();
  };

  const handleChangePassword = () => {
    setPwError(null);
    changePassword.mutate(
      { currentPassword: pwForm.current, newPassword: pwForm.next },
      {
        onSuccess: handleClosePasswordModal,
        onError: (err: any) => {
          setPwError(err?.response?.data?.message ?? 'Erro ao alterar senha. Tente novamente.');
        },
      },
    );
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const mp = settings?.mp;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* OAuth toast */}
      {toast && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={clearToast} className="ml-4 text-current opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Identity / White-label */}
      <Card padding="md" className="space-y-5">
        <p className="font-semibold text-gray-900">Identidade Visual</p>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Logo</label>
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="logo" className="h-12 object-contain mb-3 rounded-lg" />
          )}
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} className="text-gray-400" />
            <span className="text-sm text-gray-500">Enviar logo</span>
            <span className="text-xs text-gray-400">PNG ou SVG recomendado</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadLogo.mutate(file);
            }}
          />
          {uploadLogo.isPending && <p className="text-xs text-gray-400 mt-1">Enviando...</p>}
        </div>

        <Input
          label="Nome da marca"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Ex: PhotoBooth OS"
        />

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Cor primária</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4f46e5"
              className="font-mono"
            />
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveBranding} loading={updateSettings.isPending}>
            Salvar alterações
          </Button>
        </div>
      </Card>

      {/* Mercado Pago */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Mercado Pago</p>
          {mp?.connected && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle size={15} />
              Conectado
            </span>
          )}
        </div>

        {mp?.connected ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              <p>Conta: <span className="font-medium text-gray-900">{mp.email ?? '—'}</span></p>
              {mp.connectedAt && (
                <p className="mt-1 text-gray-400 text-xs">
                  Conectado em {new Date(mp.connectedAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => disconnectMp.mutate()}
              loading={disconnectMp.isPending}
            >
              <Unlink size={14} className="mr-1.5" />
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Nenhuma conta conectada. Conecte sua conta do Mercado Pago para receber pagamentos.
            </p>
            <Button
              onClick={() => connectMp.mutate()}
              loading={connectMp.isPending}
            >
              <Link2 size={14} className="mr-1.5" />
              Conectar Mercado Pago
            </Button>
          </div>
        )}
      </Card>

      {/* Account */}
      <Card padding="md" className="space-y-4">
        <p className="font-semibold text-gray-900">Conta</p>
        <Input label="Email" value={user?.email ?? ''} disabled />
        <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
          Alterar senha
        </Button>
      </Card>

      {/* Change Password Modal */}
      <Modal open={passwordOpen} onClose={handleClosePasswordModal} title="Alterar senha">
        <div className="space-y-4">
          <Input label="Senha atual" type="password" value={pwForm.current} onChange={(e) => setPwForm(p => ({ ...p, current: e.target.value }))} />
          <Input label="Nova senha" type="password" value={pwForm.next} onChange={(e) => setPwForm(p => ({ ...p, next: e.target.value }))} />
          <Input
            label="Confirmar nova senha"
            type="password"
            value={pwForm.confirm}
            onChange={(e) => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            error={pwForm.confirm && pwForm.next !== pwForm.confirm ? 'As senhas não coincidem' : undefined}
          />
          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={handleClosePasswordModal}>Cancelar</Button>
            <Button
              onClick={handleChangePassword}
              loading={changePassword.isPending}
              disabled={!pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm || changePassword.isPending}
            >
              Alterar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/pages/SettingsPage.test.tsx
```

Expected: PASS, all tests passing

- [ ] **Step 6: Run all dashboard tests to confirm no regressions**

```bash
cd apps/dashboard && npx vitest run
```

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/hooks/api/useSettings.ts apps/dashboard/src/pages/SettingsPage.tsx apps/dashboard/src/pages/SettingsPage.test.tsx
git commit -m "feat(dashboard): add Mercado Pago OAuth connection card in Settings"
```

---

## Post-Implementation: Environment Setup

Before testing the OAuth flow end-to-end, add these to the root `.env` file:

```env
MP_CLIENT_ID=your-mp-app-client-id
MP_CLIENT_SECRET=your-mp-app-client-secret
MP_OAUTH_REDIRECT_URI=http://localhost:3000/auth/mp/callback
MP_TOKEN_ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
DASHBOARD_URL=http://localhost:5173
```

Register the MP app at: [https://www.mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
Set redirect URI to: `http://localhost:3000/auth/mp/callback`
