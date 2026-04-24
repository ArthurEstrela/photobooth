# Mercado Pago OAuth Per-Tenant Implementation Design

**Goal:** Each tenant connects their own Mercado Pago account via OAuth so that photobooth payments fall into the correct account. Tenants without a connected account cannot create payments.

**Architecture:** Per-tenant MP credentials stored encrypted in the `Tenant` table. A new OAuth controller handles the connect/callback flow. The `MercadoPagoAdapter` receives the tenant's decrypted token as a parameter instead of reading a global env var. A crypto service handles AES-256-GCM encryption/decryption. Token refresh happens silently when expiry is within 7 days.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Mercado Pago OAuth, AES-256-GCM (Node.js `crypto` module), JWT (existing `jsonwebtoken`), React + Vite dashboard.

---

## Scope

This spec covers:
- Storing encrypted MP OAuth tokens per tenant in the database
- OAuth connect/callback flow (tenant initiates from dashboard)
- CSRF protection via signed JWT state parameter
- Silent token refresh 7 days before expiry
- `MercadoPagoAdapter` refactor to accept token as parameter
- Payment use-case changes to look up tenant token
- Dashboard Settings UI: connect / disconnect / status display

This spec does NOT cover:
- Platform billing (R$200/booth) — separate spec
- Admin dashboard — separate spec
- MP Webhook secret per-tenant (webhook signatures remain platform-level via `MP_WEBHOOK_SECRET`)

---

## Environment Variables

New variables required:

| Variable | Description |
|---|---|
| `MP_CLIENT_ID` | Arthur's MP app client ID (from MP Dev Portal) |
| `MP_CLIENT_SECRET` | Arthur's MP app client secret |
| `MP_OAUTH_REDIRECT_URI` | Callback URL, e.g. `https://api.domain.com/auth/mp/callback` |
| `MP_TOKEN_ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM |
| `DASHBOARD_URL` | Dashboard base URL for OAuth redirect, e.g. `https://dashboard.domain.com` |

`MP_ACCESS_TOKEN` is kept as a fallback for local development only (when `NODE_ENV !== 'production'` and no tenant token is found). It is NOT used in production.

---

## Data Model

Add to the `Tenant` model in `apps/api/prisma/schema.prisma`:

```prisma
mpAccessToken    String?   // AES-256-GCM encrypted: "iv:tag:ciphertext" (hex)
mpRefreshToken   String?   // AES-256-GCM encrypted: "iv:tag:ciphertext" (hex)
mpUserId         String?   // MP numeric user ID
mpEmail          String?   // MP account email, for display in dashboard
mpTokenExpiresAt DateTime?
mpConnectedAt    DateTime?
```

Migration: `npx prisma migrate dev --name add-mp-oauth-fields`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add 6 MP fields to Tenant |
| `apps/api/src/crypto/token-crypto.service.ts` | Create | AES-256-GCM encrypt/decrypt |
| `apps/api/src/crypto/crypto.module.ts` | Create | NestJS module exporting TokenCryptoService |
| `apps/api/src/auth/mp-oauth.controller.ts` | Create | `GET /auth/mp/connect` + `GET /auth/mp/callback` |
| `apps/api/src/auth/mp-oauth.service.ts` | Create | OAuth logic: build URL, exchange code, store tokens, refresh |
| `apps/api/src/adapters/mercadopago.adapter.ts` | Modify | Accept `accessToken` as parameter, remove global env read |
| `apps/api/src/use-cases/create-pix-payment.use-case.ts` | Modify | Look up tenant token, pass to adapter |
| `apps/api/src/use-cases/create-digital-payment.use-case.ts` | Modify | Same as above |
| `apps/api/src/controllers/tenant.controller.ts` | Modify | Add `DELETE /tenant/settings/mp` + include MP status in `GET /tenant/settings` |
| `apps/api/src/auth/auth.module.ts` | Modify | Add CryptoModule import, MpOAuthController + MpOAuthService to providers/controllers |
| `apps/dashboard/src/hooks/api/useSettings.ts` | Modify | Add `disconnectMp()` mutation |
| `apps/dashboard/src/pages/SettingsPage.tsx` | Modify | Add MP connection section |

---

## Detailed Design

### 1. TokenCryptoService

`apps/api/src/crypto/token-crypto.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.MP_TOKEN_ENCRYPTION_KEY ?? '';
    if (hex.length !== 64) throw new Error('MP_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12); // 96-bit IV for GCM
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

`apps/api/src/crypto/crypto.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TokenCryptoService } from './token-crypto.service';

@Module({
  providers: [TokenCryptoService],
  exports: [TokenCryptoService],
})
export class CryptoModule {}
```

---

### 2. MpOAuthService

`apps/api/src/auth/mp-oauth.service.ts`

**Responsibilities:**
- Build the MP authorization URL with a signed JWT `state`
- Exchange `authorization_code` for tokens
- Persist tokens (encrypted) to the tenant record
- Refresh tokens when called (replaces stored tokens)

```typescript
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from '../crypto/token-crypto.service';
import axios from 'axios';

interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  user_id: number;
}

interface MpUserResponse {
  email: string;
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
    // state = signed JWT with tenantId + nonce, expires in 10 minutes
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
    // Verify state JWT (validates signature + expiry — CSRF protection)
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
      // Token is fresh — just return it
      return this.crypto.decrypt(tenant.mpAccessToken);
    }

    // Refresh token
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
      const res = await axios.get<MpUserResponse>('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data.email;
    } catch {
      return '';
    }
  }
}
```

---

### 3. MpOAuthController

`apps/api/src/auth/mp-oauth.controller.ts`

```typescript
import { Controller, Get, Query, Res, Req, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MpOAuthService } from './mp-oauth.service';

@Controller('auth/mp')
export class MpOAuthController {
  constructor(private readonly mpOAuth: MpOAuthService) {}

  // Tenant calls this to get the MP authorization URL
  @Get('connect')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: Request) {
    const tenantId = (req.user as any).tenantId;
    const url = this.mpOAuth.buildAuthorizationUrl(tenantId);
    return { url };
  }

  // MP redirects here after tenant authorizes
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
    } catch (err) {
      res.redirect(`${dashboardUrl}/settings?mp=error`);
    }
  }
}
```

---

### 4. MercadoPagoAdapter refactor

`apps/api/src/adapters/mercadopago.adapter.ts`

Remove `private readonly accessToken = process.env.MP_ACCESS_TOKEN`.

Change `createPixPayment` and `createDigitalPayment` signatures to accept `accessToken: string` as first parameter:

```typescript
async createPixPayment(accessToken: string, dto: CreatePixDto): Promise<MpPixResponse> {
  // use accessToken in Authorization header instead of this.accessToken
}

async createDigitalPayment(accessToken: string, dto: CreateDigitalDto): Promise<MpPixResponse> {
  // same
}
```

---

### 5. Payment use-cases token lookup

Both `create-pix-payment.use-case.ts` and `create-digital-payment.use-case.ts` gain the same lookup logic.

Inject `MpOAuthService` via constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly mpAdapter: MercadoPagoAdapter,
  private readonly mpOAuth: MpOAuthService,
  // ...existing deps
) {}
```

Inside `execute()`:
```typescript
const booth = await this.prisma.booth.findUnique({
  where: { id: dto.boothId },
  select: { tenantId: true },
});

let accessToken: string;
try {
  accessToken = await this.mpOAuth.refreshIfNeeded(booth.tenantId);
} catch {
  // In dev, fall back to global env token if present
  if (process.env.NODE_ENV !== 'production' && process.env.MP_ACCESS_TOKEN) {
    accessToken = process.env.MP_ACCESS_TOKEN;
  } else {
    throw new BadRequestException('Conta Mercado Pago não conectada. Configure nas Configurações.');
  }
}

// Pass accessToken to adapter
const payment = await this.mpAdapter.createPixPayment(accessToken, dto);
```

---

### 6. Tenant controller additions

`apps/api/src/controllers/tenant.controller.ts`

**`GET /tenant/settings` response** — add MP status fields:

```typescript
{
  // existing fields...
  mp: {
    connected: !!tenant.mpAccessToken,
    email: tenant.mpEmail ?? null,
    connectedAt: tenant.mpConnectedAt ?? null,
  }
}
```

**New endpoint `DELETE /tenant/settings/mp`**:

```typescript
@Delete('settings/mp')
@UseGuards(JwtAuthGuard)
async disconnectMp(@Req() req: Request) {
  await this.mpOAuth.disconnect(req.user.tenantId);
  return { ok: true };
}
```

---

### 7. Dashboard UI

`apps/dashboard/src/pages/SettingsPage.tsx` — add a "Mercado Pago" card section:

**Not connected state:**
```
Mercado Pago
Nenhuma conta conectada.
[Conectar Mercado Pago]  ← calls GET /auth/mp/connect, then window.location.href = url
```

**Connected state:**
```
Mercado Pago                              ✓ Conectado
Conectado como: fulano@email.com
Desde: 23/04/2026
[Desconectar]  ← calls DELETE /tenant/settings/mp
```

On page load with `?mp=connected` in URL: show success toast "Mercado Pago conectado com sucesso ✓" and remove the query param from the URL.

On page load with `?mp=error`: show error toast "Erro ao conectar Mercado Pago. Tente novamente."

`apps/dashboard/src/hooks/api/useSettings.ts` — add:

```typescript
const disconnectMp = () => api.delete('/tenant/settings/mp');
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Tenant has no MP account connected | `400 Bad Request`: "Conta Mercado Pago não conectada. Configure nas Configurações." |
| OAuth state JWT expired or invalid | `401 Unauthorized`, redirect to `settings?mp=error` |
| Token refresh fails (MP revoked token) | Token fields set to `null` in DB; next payment attempt returns 400 |
| MP_TOKEN_ENCRYPTION_KEY missing | Service throws on startup — API never boots |
| `fetchEmail` fails | Stored as empty string — not fatal, payment still works |

---

## Testing

Each component has unit tests:

- `TokenCryptoService`: encrypt → decrypt roundtrip; tampered ciphertext throws
- `MpOAuthService.buildAuthorizationUrl`: returns URL with correct params; state is a valid JWT
- `MpOAuthService.handleCallback`: expired/invalid state throws; valid state stores encrypted tokens
- `MpOAuthService.refreshIfNeeded`: token fresh (>7d) → no refresh; token expiring → calls exchange; no token → throws
- `create-pix-payment.use-case`: no tenant token in prod → throws 400; no token in dev → uses env fallback
- Dashboard `SettingsPage`: connected state shows email; disconnect button calls API; `?mp=connected` shows toast
