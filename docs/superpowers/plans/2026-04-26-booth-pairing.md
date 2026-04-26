# Booth Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual `VITE_BOOTH_ID`/`VITE_BOOTH_TOKEN` env vars with a guided pairing flow: dashboard generates a 6-char code + QR, totem scans or types it, credentials are persisted in `electron-store`.

**Architecture:** API issues a scoped booth JWT (`role: 'booth'`) via a public `/booths/pair` endpoint; a new `BoothJwtGuard` replaces the existing raw-token validation on all booth endpoints; `electron-store` persists credentials in the Electron main process; totem shows `PairingScreen` on first boot and after unpair.

**Tech Stack:** NestJS + Prisma, `@nestjs/jwt`, `electron-store`, `jsqr`, `qrcode.react` (already in dashboard), Vitest + @testing-library/react.

---

## File Map

| File | Action |
|---|---|
| `apps/api/prisma/schema.prisma` | Modify — add `pairingCode`, `pairingCodeExpiresAt`, `pairedAt` to `Booth` |
| `packages/shared/src/types.ts` | Modify — add `pairedAt` to `IBooth` |
| `apps/api/src/guards/booth-jwt.guard.ts` | Create |
| `apps/api/src/use-cases/generate-pairing-code.use-case.ts` | Create |
| `apps/api/src/use-cases/generate-pairing-code.use-case.spec.ts` | Create |
| `apps/api/src/use-cases/pair-booth.use-case.ts` | Create |
| `apps/api/src/use-cases/pair-booth.use-case.spec.ts` | Create |
| `apps/api/src/controllers/booths.controller.ts` | Modify — 3 new endpoints, switch existing to BoothJwtGuard |
| `apps/api/src/app.module.ts` | Modify — register new use cases + guard |
| `apps/totem/package.json` | Modify — add `electron-store`, `jsqr` |
| `apps/totem/electron/main.ts` | Modify — add store IPC handlers |
| `apps/totem/electron/preload.ts` | Modify — expose store API on `totemAPI` |
| `apps/totem/src/hooks/useBoothCredentials.ts` | Create |
| `apps/totem/src/hooks/useBoothCredentials.test.ts` | Create |
| `apps/totem/src/screens/PairingScreen.tsx` | Create |
| `apps/totem/src/screens/PairingScreen.test.tsx` | Create |
| `apps/totem/src/App.tsx` | Modify — use `useBoothCredentials`, show PairingScreen |
| `apps/totem/src/screens/MaintenanceScreen.tsx` | Modify — add unpair button |
| `apps/dashboard/src/hooks/api/usePairingCode.ts` | Create |
| `apps/dashboard/src/components/PairingModal.tsx` | Create |
| `apps/dashboard/src/components/PairingModal.test.tsx` | Create |
| `apps/dashboard/src/pages/BoothsPage.tsx` | Modify — pairing button + modal + badge |

---

## Task 1: Schema Migration + Shared Types

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add fields to Booth model in schema.prisma**

Open `apps/api/prisma/schema.prisma`. Find the `model Booth` block. After `updatedAt DateTime @updatedAt`, add:

```prisma
  pairingCode          String?   @unique
  pairingCodeExpiresAt DateTime?
  pairedAt             DateTime?
```

- [ ] **Step 2: Add `pairedAt` to IBooth in shared types**

Open `packages/shared/src/types.ts`. Find `export interface IBooth`. Add `pairedAt: Date | null;` after `updatedAt: Date;`:

```typescript
export interface IBooth {
  id: string;
  name: string;
  token: string;
  tenantId: string;
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  activeEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
  pairedAt: Date | null;
}
```

- [ ] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name booth-pairing
```

Expected: Migration created and applied, no errors.

- [ ] **Step 4: Rebuild shared package**

```bash
cd packages/shared && npm run build
```

Expected: `dist/` updated with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations packages/shared/src/types.ts packages/shared/dist
git commit -m "feat(schema): add pairingCode, pairingCodeExpiresAt, pairedAt to Booth"
```

---

## Task 2: BoothJwtGuard

**Files:**
- Create: `apps/api/src/guards/booth-jwt.guard.ts`

- [ ] **Step 1: Create the guard**

Create `apps/api/src/guards/booth-jwt.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class BoothJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(auth.slice(7)) as any;
      if (payload.role !== 'booth') throw new UnauthorizedException();
      // If a :id route param exists, verify the token belongs to that booth
      const params = request.params as Record<string, string>;
      if (params?.id && params.id !== payload.sub) throw new UnauthorizedException();
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/guards/booth-jwt.guard.ts
git commit -m "feat(api): add BoothJwtGuard for scoped booth JWT validation"
```

---

## Task 3: GeneratePairingCodeUseCase

**Files:**
- Create: `apps/api/src/use-cases/generate-pairing-code.use-case.spec.ts`
- Create: `apps/api/src/use-cases/generate-pairing-code.use-case.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/use-cases/generate-pairing-code.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GeneratePairingCodeUseCase } from './generate-pairing-code.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

describe('GeneratePairingCodeUseCase', () => {
  let useCase: GeneratePairingCodeUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePairingCodeUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<GeneratePairingCodeUseCase>(GeneratePairingCodeUseCase);
    jest.clearAllMocks();
  });

  it('generates a 6-char code from unambiguous charset and saves to booth', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', tenantId: 'tenant-1' });
    mockPrisma.booth.update.mockResolvedValue({});

    const result = await useCase.execute('booth-1', 'tenant-1');

    expect(result.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(mockPrisma.booth.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booth-1' },
        data: expect.objectContaining({ pairingCode: result.code }),
      }),
    );
  });

  it('throws NotFoundException when booth does not belong to tenant', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('booth-999', 'tenant-1')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.booth.update).not.toHaveBeenCalled();
  });

  it('code contains no ambiguous characters (0, O, 1, I, L)', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', tenantId: 'tenant-1' });
    mockPrisma.booth.update.mockResolvedValue({});

    // Generate many codes to check statistically
    const codes = await Promise.all(
      Array.from({ length: 50 }, () => useCase.execute('booth-1', 'tenant-1')),
    );
    const allChars = codes.map((r) => r.code).join('');
    expect(allChars).not.toMatch(/[0OI1L]/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=generate-pairing-code --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement GeneratePairingCodeUseCase**

Create `apps/api/src/use-cases/generate-pairing-code.use-case.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

@Injectable()
export class GeneratePairingCodeUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(boothId: string, tenantId: string): Promise<{ code: string; expiresAt: Date }> {
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, tenantId },
    });
    if (!booth) throw new NotFoundException('Booth not found');

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.booth.update({
      where: { id: boothId },
      data: { pairingCode: code, pairingCodeExpiresAt: expiresAt },
    });

    return { code, expiresAt };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=generate-pairing-code --no-coverage
```

Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/generate-pairing-code.use-case.ts apps/api/src/use-cases/generate-pairing-code.use-case.spec.ts
git commit -m "feat(api): add GeneratePairingCodeUseCase with unambiguous charset"
```

---

## Task 4: PairBoothUseCase

**Files:**
- Create: `apps/api/src/use-cases/pair-booth.use-case.spec.ts`
- Create: `apps/api/src/use-cases/pair-booth.use-case.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/use-cases/pair-booth.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PairBoothUseCase } from './pair-booth.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn() };

const BOOTH = { id: 'booth-1', tenantId: 'tenant-1', pairingCodeExpiresAt: new Date(Date.now() + 60000) };

describe('PairBoothUseCase', () => {
  let useCase: PairBoothUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PairBoothUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    useCase = module.get<PairBoothUseCase>(PairBoothUseCase);
    jest.clearAllMocks();
  });

  it('returns boothId and signed JWT on valid code', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(BOOTH);
    mockPrisma.booth.update.mockResolvedValue({});
    mockJwt.sign.mockReturnValue('signed-jwt');

    const result = await useCase.execute('AB3K7X');

    expect(result).toEqual({ boothId: 'booth-1', token: 'signed-jwt' });
    expect(mockJwt.sign).toHaveBeenCalledWith(
      { sub: 'booth-1', tenantId: 'tenant-1', role: 'booth' },
      { expiresIn: '3650d' },
    );
  });

  it('clears pairingCode and sets pairedAt on success', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(BOOTH);
    mockPrisma.booth.update.mockResolvedValue({});
    mockJwt.sign.mockReturnValue('signed-jwt');

    await useCase.execute('AB3K7X');

    expect(mockPrisma.booth.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booth-1' },
        data: expect.objectContaining({
          pairingCode: null,
          pairingCodeExpiresAt: null,
          pairedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('throws NotFoundException when code is invalid or expired', async () => {
    mockPrisma.booth.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('BADCOD')).rejects.toThrow(NotFoundException);
    expect(mockJwt.sign).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=pair-booth --no-coverage
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement PairBoothUseCase**

Create `apps/api/src/use-cases/pair-booth.use-case.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PairBoothUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async execute(code: string): Promise<{ boothId: string; token: string }> {
    const now = new Date();
    const booth = await this.prisma.booth.findFirst({
      where: {
        pairingCode: code,
        pairingCodeExpiresAt: { gt: now },
      },
    });
    if (!booth) throw new NotFoundException('Invalid or expired pairing code');

    await this.prisma.booth.update({
      where: { id: booth.id },
      data: {
        pairingCode: null,
        pairingCodeExpiresAt: null,
        pairedAt: now,
      },
    });

    const token = this.jwt.sign(
      { sub: booth.id, tenantId: booth.tenantId, role: 'booth' },
      { expiresIn: '3650d' },
    );

    return { boothId: booth.id, token };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=pair-booth --no-coverage
```

Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/pair-booth.use-case.ts apps/api/src/use-cases/pair-booth.use-case.spec.ts
git commit -m "feat(api): add PairBoothUseCase — validates code and issues scoped booth JWT"
```

---

## Task 5: BoothsController — New Endpoints + BoothJwtGuard

**Files:**
- Modify: `apps/api/src/controllers/booths.controller.ts`

- [ ] **Step 1: Read the current file**

Read `apps/api/src/controllers/booths.controller.ts` to understand the current structure.

- [ ] **Step 2: Replace the full file**

Replace the full contents of `apps/api/src/controllers/booths.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  Body,
  Request,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from '../gateways/dashboard.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoothJwtGuard } from '../guards/booth-jwt.guard';
import { GeneratePairingCodeUseCase } from '../use-cases/generate-pairing-code.use-case';
import { PairBoothUseCase } from '../use-cases/pair-booth.use-case';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

interface BoothReq {
  user: { sub: string; tenantId: string; role: string };
}

@Controller('booths')
export class BoothsController {
  private readonly logger = new Logger(BoothsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardGateway: DashboardGateway,
    private readonly generatePairingCode: GeneratePairingCodeUseCase,
    private readonly pairBooth: PairBoothUseCase,
  ) {}

  // ── PUBLIC: pair a totem using a pairing code ─────────────────────────
  @Post('pair')
  async pair(@Body() body: { code: string }) {
    return this.pairBooth.execute(body.code.toUpperCase().trim());
  }

  // ── TENANT: generate pairing code for a booth ─────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post(':id/pairing-code')
  async generateCode(@Param('id') id: string, @Request() req: any) {
    return this.generatePairingCode.execute(id, req.user.tenantId);
  }

  // ── BOOTH: unpair this booth ──────────────────────────────────────────
  @UseGuards(BoothJwtGuard)
  @Post('unpair')
  async unpair(@Request() req: BoothReq) {
    const boothId = req.user.sub;
    await this.prisma.booth.update({
      where: { id: boothId },
      data: { pairedAt: null },
    });
    this.dashboardGateway.broadcastToTenant(req.user.tenantId, 'booth_unpaired', { boothId });
    return { ok: true };
  }

  // ── BOOTH: get config ─────────────────────────────────────────────────
  @UseGuards(BoothJwtGuard)
  @Get(':id/config')
  async getConfig(@Param('id') id: string): Promise<BoothConfigDto> {
    const booth = await this.prisma.booth.findFirst({
      where: { id },
      include: { tenant: true },
    });
    if (!booth) throw new NotFoundException();

    if (!Object.values(OfflineMode).includes(booth.offlineMode as OfflineMode)) {
      throw new InternalServerErrorException(`Unknown offlineMode: ${booth.offlineMode}`);
    }

    return {
      offlineMode: booth.offlineMode as OfflineMode,
      offlineCredits: booth.offlineCredits,
      demoSessionsPerHour: booth.demoSessionsPerHour,
      cameraSound: booth.cameraSound,
      suspended: booth.tenant.subscriptionStatus === 'SUSPENDED',
      branding: {
        logoUrl: booth.tenant.logoUrl,
        primaryColor: booth.tenant.primaryColor,
        brandName: booth.tenant.brandName,
      },
      devices: {
        selectedCamera: booth.selectedCamera ?? null,
        selectedPrinter: booth.selectedPrinter ?? null,
        maintenancePin: booth.maintenancePin ?? null,
      },
    };
  }

  // ── BOOTH: get event ──────────────────────────────────────────────────
  @UseGuards(BoothJwtGuard)
  @Get(':id/event')
  async getBoothEvent(@Param('id') id: string): Promise<BoothEventResponseDto> {
    const booth = await this.prisma.booth.findFirst({ where: { id } });
    if (!booth) throw new NotFoundException();
    if (!booth.activeEventId) throw new NotFoundException('No active event configured for this booth');

    const event = await this.prisma.event.findUnique({
      where: { id: booth.activeEventId },
      include: {
        eventTemplates: {
          orderBy: { order: 'asc' },
          include: { template: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Active event not found');

    const validPhotoCounts = [1, 2, 4] as const;
    if (!validPhotoCounts.includes(event.photoCount as 1 | 2 | 4)) {
      throw new InternalServerErrorException(`Invalid photoCount: ${event.photoCount}`);
    }

    return {
      event: {
        id: event.id,
        name: event.name,
        price: event.price.toNumber(),
        photoCount: event.photoCount as 1 | 2 | 4,
        digitalPrice: event.digitalPrice?.toNumber() ?? null,
        backgroundUrl: event.backgroundUrl,
        maxTemplates: event.maxTemplates,
      },
      templates: event.eventTemplates
        .filter((et) => !et.template.photoCount || et.template.photoCount === event.photoCount)
        .map((et) => ({
          id: et.template.id,
          name: et.template.name,
          overlayUrl: et.template.overlayUrl,
          photoCount: et.template.photoCount,
          layout: et.template.layout,
          order: et.order,
        })),
    };
  }
}
```

- [ ] **Step 3: Run API tests**

```bash
cd apps/api && npx jest --testPathPattern=booths.controller --no-coverage
```

Expected: PASS (existing tests may need updating — the guard change affects how tests mock auth; fix any failures by mocking `BoothJwtGuard` to `canActivate: () => true`).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/controllers/booths.controller.ts
git commit -m "feat(api): add pair/unpair/pairing-code endpoints, switch to BoothJwtGuard"
```

---

## Task 6: AppModule Registration

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add imports and providers**

Open `apps/api/src/app.module.ts`. Add these imports near the top:

```typescript
import { BoothJwtGuard } from './guards/booth-jwt.guard';
import { GeneratePairingCodeUseCase } from './use-cases/generate-pairing-code.use-case';
import { PairBoothUseCase } from './use-cases/pair-booth.use-case';
```

Add to the `providers` array:

```typescript
BoothJwtGuard,
GeneratePairingCodeUseCase,
PairBoothUseCase,
```

- [ ] **Step 2: Run all API tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass (2 pre-existing booth.gateway failures are acceptable).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register BoothJwtGuard, GeneratePairingCodeUseCase, PairBoothUseCase"
```

---

## Task 7: electron-store IPC (Totem)

**Files:**
- Modify: `apps/totem/package.json`
- Modify: `apps/totem/electron/main.ts`
- Modify: `apps/totem/electron/preload.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd apps/totem && npm install electron-store jsqr
```

Expected: `package.json` updated, no errors.

- [ ] **Step 2: Update electron/main.ts**

Read `apps/totem/electron/main.ts`. Add these imports at the top:

```typescript
import Store from 'electron-store';
```

After `let mainWindow: BrowserWindow | null = null;`, add:

```typescript
interface BoothStore {
  boothId: string;
  boothToken: string;
}
const store = new Store<BoothStore>();
```

At the bottom of the file, before the closing, add:

```typescript
// IPC Handlers: Booth credentials (electron-store)
ipcMain.handle('store-get-credentials', () => {
  const boothId = store.get('boothId');
  const boothToken = store.get('boothToken');
  if (!boothId || !boothToken) return null;
  return { boothId, boothToken };
});

ipcMain.handle('store-set-credentials', (_event, data: BoothStore) => {
  store.set('boothId', data.boothId);
  store.set('boothToken', data.boothToken);
});

ipcMain.handle('store-clear-credentials', () => {
  store.delete('boothId');
  store.delete('boothToken');
});
```

- [ ] **Step 3: Update electron/preload.ts**

Read `apps/totem/electron/preload.ts`. Update `contextBridge.exposeInMainWorld('totemAPI', {...})` to add three new methods:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

export interface PhotoData {
  sessionId: string;
  photoBase64: string;
}

contextBridge.exposeInMainWorld('totemAPI', {
  printPhoto: () => ipcRenderer.send('print-photo'),
  saveOfflinePhoto: (data: PhotoData) => ipcRenderer.send('save-offline-photo', data),
  getPrinters: (): Promise<Array<{ name: string }>> => ipcRenderer.invoke('get-printers'),
  getCredentials: (): Promise<{ boothId: string; boothToken: string } | null> =>
    ipcRenderer.invoke('store-get-credentials'),
  setCredentials: (data: { boothId: string; boothToken: string }): Promise<void> =>
    ipcRenderer.invoke('store-set-credentials', data),
  clearCredentials: (): Promise<void> =>
    ipcRenderer.invoke('store-clear-credentials'),
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/totem && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors from these files.

- [ ] **Step 5: Commit**

```bash
git add apps/totem/package.json apps/totem/electron/main.ts apps/totem/electron/preload.ts
git commit -m "feat(totem): add electron-store IPC for booth credentials persistence"
```

---

## Task 8: useBoothCredentials Hook

**Files:**
- Create: `apps/totem/src/hooks/useBoothCredentials.test.ts`
- Create: `apps/totem/src/hooks/useBoothCredentials.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/totem/src/hooks/useBoothCredentials.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBoothCredentials } from './useBoothCredentials';

const mockTotemAPI = {
  getCredentials: vi.fn(),
  setCredentials: vi.fn(),
  clearCredentials: vi.fn(),
};

beforeEach(() => {
  (window as any).totemAPI = mockTotemAPI;
  vi.clearAllMocks();
});

describe('useBoothCredentials', () => {
  it('returns credentials from electron-store on mount', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue({ boothId: 'b-1', boothToken: 'jwt-abc' });

    const { result } = renderHook(() => useBoothCredentials());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boothId).toBe('b-1');
    expect(result.current.boothToken).toBe('jwt-abc');
  });

  it('returns null credentials when store is empty', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue(null);

    const { result } = renderHook(() => useBoothCredentials());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.boothId).toBeNull();
    expect(result.current.boothToken).toBeNull();
  });

  it('saves credentials and updates state', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue(null);
    mockTotemAPI.setCredentials.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoothCredentials());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setCredentials({ boothId: 'b-2', boothToken: 'jwt-xyz' });
    });

    expect(mockTotemAPI.setCredentials).toHaveBeenCalledWith({ boothId: 'b-2', boothToken: 'jwt-xyz' });
    expect(result.current.boothId).toBe('b-2');
    expect(result.current.boothToken).toBe('jwt-xyz');
  });

  it('clears credentials and resets state', async () => {
    mockTotemAPI.getCredentials.mockResolvedValue({ boothId: 'b-1', boothToken: 'jwt-abc' });
    mockTotemAPI.clearCredentials.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBoothCredentials());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.clearCredentials();
    });

    expect(mockTotemAPI.clearCredentials).toHaveBeenCalled();
    expect(result.current.boothId).toBeNull();
    expect(result.current.boothToken).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/totem && npx vitest run src/hooks/useBoothCredentials.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement useBoothCredentials**

Create `apps/totem/src/hooks/useBoothCredentials.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';

interface Credentials {
  boothId: string;
  boothToken: string;
}

interface UseBoothCredentials {
  boothId: string | null;
  boothToken: string | null;
  isLoading: boolean;
  setCredentials: (creds: Credentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
}

export function useBoothCredentials(): UseBoothCredentials {
  const [boothId, setBoothId] = useState<string | null>(null);
  const [boothToken, setBoothToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const api = (window as any).totemAPI;
    if (!api?.getCredentials) {
      setIsLoading(false);
      return;
    }
    api.getCredentials().then((creds: Credentials | null) => {
      if (creds) {
        setBoothId(creds.boothId);
        setBoothToken(creds.boothToken);
      }
      setIsLoading(false);
    });
  }, []);

  const setCredentials = useCallback(async (creds: Credentials) => {
    const api = (window as any).totemAPI;
    await api?.setCredentials(creds);
    setBoothId(creds.boothId);
    setBoothToken(creds.boothToken);
  }, []);

  const clearCredentials = useCallback(async () => {
    const api = (window as any).totemAPI;
    await api?.clearCredentials();
    setBoothId(null);
    setBoothToken(null);
  }, []);

  return { boothId, boothToken, isLoading, setCredentials, clearCredentials };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/totem && npx vitest run src/hooks/useBoothCredentials.test.ts
```

Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/hooks/useBoothCredentials.ts apps/totem/src/hooks/useBoothCredentials.test.ts
git commit -m "feat(totem): add useBoothCredentials hook for electron-store persistence"
```

---

## Task 9: PairingScreen

**Files:**
- Create: `apps/totem/src/screens/PairingScreen.test.tsx`
- Create: `apps/totem/src/screens/PairingScreen.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/totem/src/screens/PairingScreen.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PairingScreen } from './PairingScreen';
import axios from 'axios';

vi.mock('axios');
const mockSetCredentials = vi.fn();

describe('PairingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders QR scan mode by default', () => {
    render(<PairingScreen onPaired={mockSetCredentials} />);
    expect(screen.getByText(/pareamento/i)).toBeTruthy();
    expect(screen.getByText(/digitar manualmente/i)).toBeTruthy();
  });

  it('switches to manual input mode', () => {
    render(<PairingScreen onPaired={mockSetCredentials} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));
    expect(screen.getByPlaceholderText(/AB3K7X/i)).toBeTruthy();
    expect(screen.getByText(/parear/i)).toBeTruthy();
  });

  it('calls API and invokes onPaired with credentials on success', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { boothId: 'b-1', token: 'jwt-abc' },
    });

    render(<PairingScreen onPaired={mockSetCredentials} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));

    const input = screen.getByPlaceholderText(/AB3K7X/i);
    fireEvent.change(input, { target: { value: 'AB3K7X' } });
    fireEvent.click(screen.getByText(/parear/i));

    await waitFor(() => {
      expect(mockSetCredentials).toHaveBeenCalledWith({ boothId: 'b-1', boothToken: 'jwt-abc' });
    });
  });

  it('shows error message on invalid code', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 404 } });

    render(<PairingScreen onPaired={mockSetCredentials} />);
    fireEvent.click(screen.getByText(/digitar manualmente/i));

    const input = screen.getByPlaceholderText(/AB3K7X/i);
    fireEvent.change(input, { target: { value: 'BADCOD' } });
    fireEvent.click(screen.getByText(/parear/i));

    await waitFor(() => {
      expect(screen.getByText(/inválido ou expirado/i)).toBeTruthy();
    });
    expect(mockSetCredentials).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/totem && npx vitest run src/screens/PairingScreen.test.tsx
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement PairingScreen**

Create `apps/totem/src/screens/PairingScreen.tsx`:

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import jsQR from 'jsqr';

interface Props {
  onPaired: (creds: { boothId: string; boothToken: string }) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PairingScreen: React.FC<Props> = ({ onPaired }) => {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const handleCode = useCallback(async (code: string) => {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_URL}/booths/pair`, { code: code.toUpperCase().trim() });
      await onPaired({ boothId: data.boothId, boothToken: data.token });
    } catch {
      setError('Código inválido ou expirado. Gere um novo no painel.');
      setScanning(true);
    } finally {
      setLoading(false);
    }
  }, [loading, onPaired]);

  // Start webcam and QR scanning loop
  useEffect(() => {
    if (mode !== 'scan') return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setMode('manual'));

    const tick = () => {
      if (!scanning) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imageData.data, imageData.width, imageData.height);
          if (qr?.data) {
            handleCode(qr.data);
            return;
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode, scanning, handleCode]);

  const handleManualSubmit = () => {
    if (manualCode.trim().length === 6) handleCode(manualCode);
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-950 gap-8 p-6">
      <div className="text-center space-y-2">
        <h1 className="text-white text-2xl font-bold">Pareamento de Cabine</h1>
        <p className="text-white/50 text-sm">
          Gere um código no painel e escaneie o QR abaixo.
        </p>
      </div>

      {mode === 'scan' ? (
        <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-2 border-white/20">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* Viewfinder corners */}
          <div className="absolute inset-4 border-2 border-primary rounded-xl pointer-events-none" />
        </div>
      ) : (
        <div className="space-y-3 w-72">
          <input
            className="w-full bg-white/10 text-white text-center text-2xl font-mono tracking-[0.4em] rounded-2xl px-4 py-4 border border-white/20 focus:outline-none focus:border-primary uppercase"
            placeholder="AB3K7X"
            maxLength={6}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          />
          <button
            onClick={handleManualSubmit}
            disabled={loading || manualCode.trim().length < 6}
            className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-40 text-white rounded-2xl font-semibold transition-opacity"
          >
            {loading ? 'Pareando...' : 'Parear'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>
      )}

      <button
        onClick={() => { setMode(mode === 'scan' ? 'manual' : 'scan'); setError(null); setManualCode(''); }}
        className="text-white/40 text-sm hover:text-white/70 transition-colors"
      >
        {mode === 'scan' ? 'Digitar manualmente' : 'Escanear QR Code'}
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/totem && npx vitest run src/screens/PairingScreen.test.tsx
```

Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/PairingScreen.tsx apps/totem/src/screens/PairingScreen.test.tsx
git commit -m "feat(totem): add PairingScreen with QR scan and manual code input"
```

---

## Task 10: App.tsx Integration (Totem)

**Files:**
- Modify: `apps/totem/src/App.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/totem/src/App.tsx`.

- [ ] **Step 2: Update App.tsx**

Replace the file with the following (key changes: remove `VITE_BOOTH_ID`/`VITE_BOOTH_TOKEN` constants, add `useBoothCredentials`, show `PairingScreen` when no credentials):

```typescript
import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { useDeviceConfig } from './hooks/useDeviceConfig';
import { useDeviceHeartbeat } from './hooks/useDeviceHeartbeat';
import { useBoothCredentials } from './hooks/useBoothCredentials';
import { CameraEngine } from './components/CameraEngine';
import { IdleScreen } from './screens/IdleScreen';
import { FrameSelectionScreen } from './screens/FrameSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';
import { PinScreen } from './screens/PinScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';
import { PairingScreen } from './screens/PairingScreen';

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const { boothId, boothToken, isLoading: credsLoading, setCredentials } = useBoothCredentials();
  const { videoRef } = useWebcam();
  const { deviceConfig, setDeviceConfig } = useDeviceConfig();
  const { config }   = useBoothConfig(boothId ?? '', boothToken ?? '', setDeviceConfig);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(boothId ?? '', boothToken ?? '');
  const machine = useBoothMachine(boothId ?? '', boothToken ?? '', config, setDeviceConfig);

  useDeviceHeartbeat(machine.socketRef, boothId ?? '', deviceConfig);

  const isSuspended = config?.suspended === true;

  const [isSelectingFrame, setIsSelectingFrame]   = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showPin, setShowPin]                       = useState(false);
  const [showMaintenance, setShowMaintenance]       = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    const color = config?.branding.primaryColor;
    if (color) {
      try {
        document.documentElement.style.setProperty('--color-primary-rgb', hexToRgbString(color));
      } catch {
        // invalid color format — skip
      }
    }
  }, [config?.branding.primaryColor]);

  useEffect(() => {
    if (machine.state === BoothState.IDLE) {
      setIsSelectingFrame(false);
      setSelectedTemplateId('');
    }
  }, [machine.state]);

  const handleIdleTap = () => {
    if (!eventLoading && templates.length > 0) {
      setIsSelectingFrame(true);
    }
  };

  const handleConfirmFrame = () => {
    if (!event || !selectedTemplateId) return;
    setIsSelectingFrame(false);
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  // Show loading screen while reading credentials from electron-store
  if (credsLoading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Show pairing screen when no credentials stored
  if (!boothId || !boothToken) {
    return (
      <PairingScreen
        onPaired={async (creds) => {
          await setCredentials(creds);
          window.location.reload();
        }}
      />
    );
  }

  if (isSuspended) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950">
        <div className="text-center space-y-4 px-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <p className="text-white text-xl font-semibold">Sistema Suspenso</p>
          <p className="text-white/50 text-sm">Entre em contato com o operador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950">

      {machine.state === BoothState.IDLE && !isSelectingFrame && (
        <IdleScreen
          brandName={config?.branding.brandName ?? null}
          logoUrl={config?.branding.logoUrl ?? null}
          backgroundUrl={event?.backgroundUrl ?? null}
          eventLoading={eventLoading}
          hasEvent={!!event}
          hasTemplates={templates.length > 0}
          onTap={handleIdleTap}
          onSecretTap={() => setShowPin(true)}
        />
      )}

      {machine.state === BoothState.IDLE && isSelectingFrame && (
        <FrameSelectionScreen
          templates={templates}
          selectedId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmFrame}
          videoRef={videoRef}
        />
      )}

      {machine.state === BoothState.WAITING_PAYMENT && (
        <PaymentScreen
          amount={event?.price ?? 0}
          payment={machine.currentPayment ?? null}
          onCancel={() => machine.startPayment('', '', 0)}
        />
      )}

      {(machine.state === BoothState.IN_SESSION ||
        machine.state === BoothState.COUNTDOWN ||
        machine.state === BoothState.CAPTURING) && (
        <CameraEngine
          overlayUrl={selectedTemplate?.overlayUrl}
          sessionId={machine.sessionId ?? 'session'}
          photoCount={(selectedTemplate?.photoCount ?? event?.photoCount ?? 1) as 1 | 2 | 4}
          layout={selectedTemplate?.layout}
          cameraSound={config?.cameraSound ?? true}
          onProcessing={() => machine.setProcessing()}
          onStripReady={(strip) => machine.completeSession(strip)}
        />
      )}

      {machine.state === BoothState.PROCESSING && (
        <ProcessingScreen photoCount={event?.photoCount ?? 1} />
      )}

      {machine.state === BoothState.DELIVERY && (
        <DeliveryScreen
          sessionId={machine.sessionId ?? ''}
          photoUrl={machine.stripDataUrl}
          digitalPrice={event?.digitalPrice ?? null}
          brandName={config?.branding.brandName ?? null}
          onDone={() => {
            setIsSelectingFrame(false);
            setSelectedTemplateId('');
            machine.resetToIdle();
          }}
        />
      )}

      {showPin && (
        <PinScreen
          pinHash={deviceConfig.maintenancePinHash}
          onSuccess={() => { setShowPin(false); setShowMaintenance(true); }}
          onClose={() => setShowPin(false)}
        />
      )}
      {showMaintenance && (
        <MaintenanceScreen
          boothId={boothId}
          boothToken={boothToken}
          socketRef={machine.socketRef}
          deviceConfig={deviceConfig}
          setDeviceConfig={setDeviceConfig}
          onClose={() => setShowMaintenance(false)}
        />
      )}

    </div>
  );
}
```

- [ ] **Step 3: Run totem tests**

```bash
cd apps/totem && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/totem/src/App.tsx
git commit -m "feat(totem): use useBoothCredentials, show PairingScreen on first boot"
```

---

## Task 11: MaintenanceScreen — Unpair Button

**Files:**
- Modify: `apps/totem/src/screens/MaintenanceScreen.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/totem/src/screens/MaintenanceScreen.tsx`.

- [ ] **Step 2: Add boothToken prop and unpair button**

Update the `Props` interface to add `boothToken: string`:

```typescript
interface Props {
  boothId: string;
  boothToken: string;
  socketRef: React.MutableRefObject<Socket | null>;
  deviceConfig: DeviceConfig;
  setDeviceConfig: (partial: Partial<DeviceConfig>) => void;
  onClose: () => void;
}
```

Update the destructuring:
```typescript
export const MaintenanceScreen: React.FC<Props> = ({
  boothId,
  boothToken,
  socketRef,
  deviceConfig,
  setDeviceConfig,
  onClose,
}) => {
```

Add `axios` import at the top:
```typescript
import axios from 'axios';
```

Add `unpairing` state:
```typescript
const [unpairing, setUnpairing] = useState(false);
```

Add `handleUnpair` function after `handleSave`:
```typescript
const handleUnpair = async () => {
  setUnpairing(true);
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  try {
    await axios.post(`${apiUrl}/booths/unpair`, {}, {
      headers: { Authorization: `Bearer ${boothToken}` },
    });
  } catch {
    // fire-and-forget — proceed with local cleanup regardless
  }
  const totemAPI = (window as any).totemAPI;
  await totemAPI?.clearCredentials?.();
  window.location.reload();
};
```

Add the unpair button inside the drawer, after the "Salvar e Voltar" button:

```tsx
{/* Unpair */}
<button
  onClick={handleUnpair}
  disabled={unpairing}
  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 rounded-2xl font-semibold text-sm transition-colors border border-red-500/20"
>
  {unpairing ? 'Despareando...' : 'Desparear Cabine'}
</button>
```

- [ ] **Step 3: Run totem tests**

```bash
cd apps/totem && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/totem/src/screens/MaintenanceScreen.tsx
git commit -m "feat(totem): add unpair button to MaintenanceScreen"
```

---

## Task 12: usePairingCode Hook + PairingModal (Dashboard)

**Files:**
- Create: `apps/dashboard/src/hooks/api/usePairingCode.ts`
- Create: `apps/dashboard/src/components/PairingModal.test.tsx`
- Create: `apps/dashboard/src/components/PairingModal.tsx`

- [ ] **Step 1: Install qrcode.react in dashboard**

```bash
cd apps/dashboard && npm install qrcode.react
```

Expected: `package.json` updated, no errors.

- [ ] **Step 2: Create usePairingCode hook**

Create `apps/dashboard/src/hooks/api/usePairingCode.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/api';

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export const usePairingCode = () =>
  useMutation<PairingCodeResponse, unknown, string>({
    mutationFn: (boothId: string) =>
      api.post(`/booths/${boothId}/pairing-code`).then((r) => r.data),
  });
```

- [ ] **Step 3: Write failing tests for PairingModal**

Create `apps/dashboard/src/components/PairingModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PairingModal } from './PairingModal';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr">{value}</div>,
}));

describe('PairingModal', () => {
  const onClose = vi.fn();
  const expiresAt = new Date(Date.now() + 1800000).toISOString();

  it('renders the pairing code in large text', () => {
    render(
      <PairingModal
        boothId="b-1"
        code="AB3K7X"
        expiresAt={expiresAt}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByText('AB3K7X')).toBeTruthy();
  });

  it('renders a QR code with the pairing code as value', () => {
    render(
      <PairingModal
        boothId="b-1"
        code="AB3K7X"
        expiresAt={expiresAt}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('qr').textContent).toBe('AB3K7X');
  });

  it('shows expired state when expiresAt is in the past', () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    render(
      <PairingModal
        boothId="b-1"
        code="AB3K7X"
        expiresAt={pastExpiry}
        onClose={onClose}
        onRegenerate={vi.fn()}
      />,
    );
    expect(screen.getByText(/expirado/i)).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/components/PairingModal.test.tsx
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 5: Implement PairingModal**

Create `apps/dashboard/src/components/PairingModal.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw } from 'lucide-react';

interface Props {
  boothId: string;
  code: string;
  expiresAt: string;
  onClose: () => void;
  onRegenerate: () => void;
}

export const PairingModal: React.FC<Props> = ({ code, expiresAt, onClose, onRegenerate }) => {
  const [secsLeft, setSecsLeft] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecsLeft(calc());
    const timer = setInterval(() => setSecsLeft(calc()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const expired = secsLeft === 0;
  const mins = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const secs = String(secsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Parear Cabine</p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className={`flex justify-center ${expired ? 'opacity-30' : ''}`}>
          <QRCodeSVG value={code} size={180} />
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400">Ou digite manualmente no totem</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-gray-900">{code}</p>
        </div>

        {expired ? (
          <div className="space-y-2 text-center">
            <p className="text-sm text-red-500 font-medium">Código expirado. Regenere.</p>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-2 mx-auto text-sm text-primary font-medium hover:opacity-80"
            >
              <RefreshCw size={14} /> Regenerar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Expira em</span>
            <span className="font-mono font-medium text-gray-700">{mins}:{secs}</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/components/PairingModal.test.tsx
```

Expected: PASS, 3 tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/src/hooks/api/usePairingCode.ts apps/dashboard/src/components/PairingModal.tsx apps/dashboard/src/components/PairingModal.test.tsx
git commit -m "feat(dashboard): add usePairingCode hook and PairingModal with QR + countdown"
```

---

## Task 13: BoothsPage — Pairing Button + Modal + Badge

**Files:**
- Modify: `apps/dashboard/src/pages/BoothsPage.tsx`

- [ ] **Step 1: Read the current file**

Read `apps/dashboard/src/pages/BoothsPage.tsx` in full to understand the current structure.

- [ ] **Step 2: Add imports**

At the top of the file, add:

```typescript
import { Link2, Link2Off } from 'lucide-react';
import { usePairingCode } from '../hooks/api/usePairingCode';
import { PairingModal } from '../components/PairingModal';
```

- [ ] **Step 3: Add state and hook**

Inside `BoothsPage`, after existing state declarations, add:

```typescript
const generatePairingCode = usePairingCode();
const [pairingBooth, setPairingBooth] = useState<any | null>(null);
const [pairingData, setPairingData] = useState<{ code: string; expiresAt: string } | null>(null);
```

- [ ] **Step 4: Add pairedAt badge to booth cards**

In the booth card rendering, find the `<Badge>` that shows online/offline status and add a second badge next to it:

```tsx
<div className="flex items-center gap-2">
  <Badge variant={booth.isOnline ? 'success' : 'neutral'}>
    {booth.isOnline ? 'Online' : 'Offline'}
  </Badge>
  <Badge variant={booth.pairedAt ? 'success' : 'neutral'}>
    {booth.pairedAt ? 'Pareado' : 'Não pareado'}
  </Badge>
</div>
```

- [ ] **Step 5: Add "Gerar pareamento" button in drawer**

Inside the Drawer content (`<Drawer open onClose=...>`), after the existing content, add a section:

```tsx
{/* Pairing */}
<div className="border-t border-gray-100 pt-4 space-y-2">
  <p className="text-sm font-semibold text-gray-700">Pareamento</p>
  <div className="flex items-center gap-2 text-sm text-gray-500">
    {drawerBooth.pairedAt ? (
      <><Link2 size={14} className="text-green-500" /> Pareado</>
    ) : (
      <><Link2Off size={14} /> Não pareado</>
    )}
  </div>
  <Button
    size="sm"
    variant="secondary"
    onClick={() => {
      setPairingBooth(drawerBooth);
      generatePairingCode.mutate(drawerBooth.id, {
        onSuccess: (data) => setPairingData(data),
      });
    }}
    loading={generatePairingCode.isPending}
  >
    Gerar código de pareamento
  </Button>
</div>
```

- [ ] **Step 6: Render PairingModal**

After the closing `</Drawer>` tag, add:

```tsx
{pairingBooth && pairingData && (
  <PairingModal
    boothId={pairingBooth.id}
    code={pairingData.code}
    expiresAt={pairingData.expiresAt}
    onClose={() => { setPairingBooth(null); setPairingData(null); generatePairingCode.reset(); }}
    onRegenerate={() => {
      generatePairingCode.mutate(pairingBooth.id, {
        onSuccess: (data) => setPairingData(data),
      });
    }}
  />
)}
```

- [ ] **Step 7: Run all dashboard tests**

```bash
cd apps/dashboard && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Verify TypeScript**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/dashboard/src/pages/BoothsPage.tsx
git commit -m "feat(dashboard): add pairing button, modal, and pairedAt badge to BoothsPage"
```

---

## Post-Implementation: Testing the Full Flow

**1. Start services:**
```bash
docker compose up db redis -d
cd apps/api && npm run dev
cd apps/dashboard && npm run dev
```

**2. Create a booth in the dashboard** and click "Gerar código de pareamento" — a modal appears with a QR and 6-char code.

**3. In the totem** (run `npm run electron` or `npm run dev`), the PairingScreen appears on first boot. Type the 6-char code and click "Parear". The totem should reload and enter the normal booth flow.

**4. Verify unpair:** Open maintenance mode (secret tap → PIN), click "Desparear Cabine". The totem returns to PairingScreen. The dashboard badge changes to "Não pareado".
