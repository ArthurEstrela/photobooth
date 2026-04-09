# Plano 3 — Dashboard Full SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Dashboard SaaS with live Booths, Gallery, Payments, and Settings pages, backed by secure JWT-protected API endpoints and real-time WebSocket events for all pages.

**Architecture:** A new `DashboardGateway` on the root Socket.IO namespace handles tenant authentication and broadcasts events (`booth_status`, `photo_synced`, `payment_approved`) to tenant-scoped rooms. All existing dashboard API endpoints are migrated from insecure `?tenantId` query params to `JwtAuthGuard` + `req.user.tenantId`. Four new dashboard pages consume new API endpoints added to `TenantController` and `PhotoController`.

**Tech Stack:** NestJS + Prisma (API), React + Vite + TanStack Query + Socket.IO client (dashboard), Vitest + @testing-library/react (dashboard tests), Jest (API tests), Tailwind CSS, Lucide React.

---

## File Map

**New files:**
- `apps/api/src/gateways/dashboard.gateway.ts` — root namespace WS gateway for tenant dashboard rooms
- `apps/api/src/gateways/dashboard.gateway.spec.ts`
- `apps/api/src/controllers/tenant.controller.spec.ts` — all new TenantController endpoint tests
- `apps/dashboard/src/hooks/api/useBooths.ts`
- `apps/dashboard/src/hooks/api/useGallery.ts`
- `apps/dashboard/src/hooks/api/usePayments.ts`
- `apps/dashboard/src/hooks/api/useSettings.ts`
- `apps/dashboard/src/pages/BoothsPage.tsx`
- `apps/dashboard/src/pages/GalleryPage.tsx`
- `apps/dashboard/src/pages/PaymentsPage.tsx`
- `apps/dashboard/src/pages/SettingsPage.tsx`
- `apps/dashboard/src/pages/BoothsPage.test.tsx`
- `apps/dashboard/src/pages/GalleryPage.test.tsx`
- `apps/dashboard/src/pages/PaymentsPage.test.tsx`
- `apps/dashboard/src/pages/SettingsPage.test.tsx`

**Modified files:**
- `packages/shared/src/types.ts` — add 5 new types
- `apps/api/src/gateways/booth.gateway.ts` — store tenantId in map, inject DashboardGateway, add `isBoothOnline` / `getOnlineBoothCount`
- `apps/api/src/controllers/tenant.controller.ts` — full rewrite with JWT + 6 new endpoints
- `apps/api/src/controllers/event.controller.ts` — replace `?tenantId` with `req.user.tenantId`
- `apps/api/src/controllers/photo.controller.ts` — add public `GET /photos/public/:sessionId`
- `apps/api/src/use-cases/process-webhook.use-case.ts` — inject DashboardGateway, broadcast to tenant room
- `apps/api/src/use-cases/sync-photo.use-case.ts` — inject DashboardGateway, broadcast `photo_synced`
- `apps/api/src/app.module.ts` — register DashboardGateway as provider
- `apps/dashboard/src/hooks/useDashboardSocket.ts` — JWT auth handshake, add `booth_status` + `photo_synced` listeners
- `apps/dashboard/src/components/DashboardLayout.tsx` — add Payments + Settings nav links + working logout
- `apps/dashboard/src/App.tsx` — add `/payments` and `/settings` routes
- `apps/dashboard/src/pages/Home.tsx` — real `activeBooths` + `conversionRate` KPIs
- `apps/dashboard/src/pages/GuestPhoto.tsx` — real API call instead of mock URL

---

## Task 1: Add shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add 5 new interfaces at the end of `packages/shared/src/types.ts`**

Append after the last line of the file:

```typescript
export interface IBoothWithStatus extends IBooth {
  isOnline: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IPaymentRecord {
  id: string;
  amount: number;
  status: PaymentStatus;
  eventName: string;
  boothName: string;
  createdAt: Date;
}

export interface IGallerySession {
  sessionId: string;
  photoUrls: string[];
  eventName: string;
  boothName: string;
  createdAt: Date;
}

export interface UpdateTenantSettingsDto {
  logoUrl?: string | null;
  primaryColor?: string | null;
  brandName?: string | null;
}

export interface ITenantSettings {
  logoUrl: string | null;
  primaryColor: string | null;
  brandName: string | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add IBoothWithStatus, PaginatedResponse, IPaymentRecord, IGallerySession, settings DTOs"
```

---

## Task 2: DashboardGateway

**Files:**
- Create: `apps/api/src/gateways/dashboard.gateway.ts`
- Create: `apps/api/src/gateways/dashboard.gateway.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/gateways/dashboard.gateway.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd apps/api && npx jest --testPathPattern=dashboard.gateway.spec --no-coverage`
Expected: FAIL — `DashboardGateway` not found

- [ ] **Step 3: Implement DashboardGateway**

Create `apps/api/src/gateways/dashboard.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/jwt.strategy';

@WebSocketGateway({ cors: { origin: '*' } })
export class DashboardGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth['token'] as string;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data['tenantId'] = payload.sub;
      client.join(`tenant:${payload.sub}`);
      this.logger.log(`Dashboard client connected: tenant=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  broadcastToTenant(tenantId: string, event: string, data?: unknown) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd apps/api && npx jest --testPathPattern=dashboard.gateway.spec --no-coverage`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/gateways/dashboard.gateway.ts apps/api/src/gateways/dashboard.gateway.spec.ts
git commit -m "feat(api): add DashboardGateway with JWT auth and tenant room broadcasting"
```

---

## Task 3: Update BoothGateway to track tenantId and emit booth_status

**Files:**
- Modify: `apps/api/src/gateways/booth.gateway.ts`
- Modify: `apps/api/src/gateways/booth.gateway.spec.ts`

- [ ] **Step 1: Write failing tests for new BoothGateway behaviors**

Open `apps/api/src/gateways/booth.gateway.spec.ts` and read it, then add the following 3 new test cases (add after the existing tests):

```typescript
// In the describe block, add to mockDashboardGateway in providers:
// { provide: DashboardGateway, useValue: { broadcastToTenant: jest.fn() } }

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

describe('broadcastToTenant on connect/disconnect', () => {
  it('broadcasts booth_status online when booth connects', async () => {
    const mockDashboard = gateway['dashboardGateway'] as { broadcastToTenant: jest.Mock };
    const mockPrisma = gateway['prisma'] as { booth: { findFirst: jest.Mock } };
    mockPrisma.booth.findFirst.mockResolvedValueOnce({
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
```

- [ ] **Step 2: Run the tests — verify new ones fail**

Run: `cd apps/api && npx jest --testPathPattern=booth.gateway.spec --no-coverage`
Expected: 3 new tests FAIL (method not found / wrong behavior)

- [ ] **Step 3: Rewrite BoothGateway with DashboardGateway injection and tenantId tracking**

Replace the full content of `apps/api/src/gateways/booth.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothStateUpdate } from '@packages/shared';
import { DashboardGateway } from './dashboard.gateway';

interface BoothEntry {
  socketId: string;
  tenantId: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'booth' })
export class BoothGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BoothGateway.name);
  private connectedBooths = new Map<string, BoothEntry>(); // boothId → { socketId, tenantId }

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async handleConnection(client: Socket) {
    const boothId = client.handshake.query['boothId'] as string;
    const authHeader = client.handshake.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (!boothId || !token) {
      client.disconnect();
      return;
    }

    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, token },
    });

    if (!booth) {
      this.logger.warn(`Connection rejected for booth ${boothId} — invalid token`);
      client.disconnect();
      return;
    }

    this.connectedBooths.set(boothId, { socketId: client.id, tenantId: booth.tenantId });
    this.dashboardGateway.broadcastToTenant(booth.tenantId, 'booth_status', {
      boothId,
      online: true,
    });
    this.logger.log(`Booth connected: ${boothId}`);
  }

  handleDisconnect(client: Socket) {
    const entry = Array.from(this.connectedBooths.entries()).find(
      ([, e]) => e.socketId === client.id,
    );

    if (entry) {
      const [boothId, { tenantId }] = entry;
      this.connectedBooths.delete(boothId);
      this.dashboardGateway.broadcastToTenant(tenantId, 'booth_status', {
        boothId,
        online: false,
      });
      this.logger.log(`Booth disconnected: ${boothId}`);
    }
  }

  @SubscribeMessage('update_state')
  handleStateUpdate(
    @MessageBody() data: BoothStateUpdate,
    @ConnectedSocket() _client: Socket,
  ) {
    this.logger.log(`Booth ${data.boothId} → state: ${data.state}`);
  }

  isBoothOnline(boothId: string): boolean {
    return this.connectedBooths.has(boothId);
  }

  getOnlineBoothCount(tenantId: string): number {
    let count = 0;
    for (const entry of this.connectedBooths.values()) {
      if (entry.tenantId === tenantId) count++;
    }
    return count;
  }

  sendPaymentApproved(boothId: string, payload: unknown) {
    const entry = this.connectedBooths.get(boothId);
    if (entry) {
      this.server.to(entry.socketId).emit('payment_approved', payload);
    }
  }

  sendPaymentExpired(boothId: string) {
    const entry = this.connectedBooths.get(boothId);
    if (entry) {
      this.server.to(entry.socketId).emit('payment_expired');
    }
  }
}
```

- [ ] **Step 4: Update booth.gateway.spec.ts to provide DashboardGateway mock**

In the `beforeEach` testing module setup, add `DashboardGateway` to providers:

```typescript
// Find the providers array in beforeEach and add:
{ provide: DashboardGateway, useValue: { broadcastToTenant: jest.fn() } },
```

Also add the import at the top:
```typescript
import { DashboardGateway } from './dashboard.gateway';
```

- [ ] **Step 5: Run ALL booth gateway tests — verify they all pass**

Run: `cd apps/api && npx jest --testPathPattern=booth.gateway.spec --no-coverage`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gateways/booth.gateway.ts apps/api/src/gateways/booth.gateway.spec.ts
git commit -m "feat(api): BoothGateway tracks tenantId per booth, broadcasts booth_status to dashboard"
```

---

## Task 4: TenantController — JWT auth + real metrics

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Create: `apps/api/src/controllers/tenant.controller.spec.ts`

The existing `TenantController.getMetrics` accepts `?tenantId` (insecure). We replace it with JWT auth and add real `conversionRate` (APPROVED / resolved payments × 100) and `activeBooths` (from BoothGateway).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/controllers/tenant.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { TenantController } from './tenant.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const mockPrisma = {
  payment: {
    count: jest.fn(),
  },
  photoSession: { count: jest.fn() },
  booth: { findMany: jest.fn(), create: jest.fn() },
  photoSession: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  event: { findMany: jest.fn() },
  tenant: { findUnique: jest.fn(), update: jest.fn() },
};

const mockBoothGateway = {
  isBoothOnline: jest.fn(),
  getOnlineBoothCount: jest.fn(),
};

const TENANT_USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('TenantController — getMetrics', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns totalRevenue, totalSessions, conversionRate, activeBooths', async () => {
    // approved=8, expired=1, rejected=1 → conversionRate = 8/10 * 100 = 80
    mockPrisma.payment.count
      .mockResolvedValueOnce(8)   // APPROVED
      .mockResolvedValueOnce(1)   // EXPIRED
      .mockResolvedValueOnce(1);  // REJECTED
    mockPrisma.payment.aggregate = jest.fn().mockResolvedValueOnce({ _sum: { amount: 120 } });
    mockPrisma.photoSession.count.mockResolvedValueOnce(8);
    mockBoothGateway.getOnlineBoothCount.mockReturnValue(3);

    const result = await controller.getMetrics(TENANT_USER as any);

    expect(result.totalRevenue).toBe(120);
    expect(result.totalSessions).toBe(8);
    expect(result.conversionRate).toBe(80);
    expect(result.activeBooths).toBe(3);
  });

  it('returns conversionRate 0 when no resolved payments', async () => {
    mockPrisma.payment.count
      .mockResolvedValueOnce(0)  // APPROVED
      .mockResolvedValueOnce(0)  // EXPIRED
      .mockResolvedValueOnce(0); // REJECTED
    mockPrisma.payment.aggregate = jest.fn().mockResolvedValueOnce({ _sum: { amount: null } });
    mockPrisma.photoSession.count.mockResolvedValueOnce(0);
    mockBoothGateway.getOnlineBoothCount.mockReturnValue(0);

    const result = await controller.getMetrics(TENANT_USER as any);

    expect(result.conversionRate).toBe(0);
    expect(result.activeBooths).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: FAIL (TenantController not yet updated)

- [ ] **Step 3: Rewrite TenantController with JWT and real metrics**

Replace full content of `apps/api/src/controllers/tenant.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';
import {
  TenantMetrics,
  IBoothWithStatus,
  PaginatedResponse,
  IGallerySession,
  IPaymentRecord,
  ITenantSettings,
  UpdateTenantSettingsDto,
} from '@packages/shared';

interface AuthReq {
  user: RequestUser;
}

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
  ) {}

  @Get('metrics')
  async getMetrics(@Request() req: AuthReq): Promise<TenantMetrics> {
    const { tenantId } = req.user;

    const where = { booth: { tenantId } };

    const [approved, expired, rejected, revenueAgg, totalSessions] = await Promise.all([
      this.prisma.payment.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.payment.count({ where: { ...where, status: 'REJECTED' } }),
      this.prisma.payment.aggregate({ where: { ...where, status: 'APPROVED' }, _sum: { amount: true } }),
      this.prisma.photoSession.count({ where: { booth: { tenantId } } }),
    ]);

    const resolved = approved + expired + rejected;
    const conversionRate = resolved === 0 ? 0 : Math.round((approved / resolved) * 100);

    return {
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      totalSessions,
      conversionRate,
      activeBooths: this.boothGateway.getOnlineBoothCount(tenantId),
    };
  }
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): TenantController uses JwtAuthGuard, returns real conversionRate and activeBooths"
```

---

## Task 5: TenantController — booth endpoints

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/tenant.controller.spec.ts`

- [ ] **Step 1: Add failing tests for GET /tenant/booths and POST /tenant/booths**

Append to `apps/api/src/controllers/tenant.controller.spec.ts` (inside the outer describe or as new describes):

```typescript
describe('TenantController — booths', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('GET /tenant/booths returns booths with isOnline flag', async () => {
    mockPrisma.booth.findMany.mockResolvedValueOnce([
      { id: 'b-1', name: 'Booth 1', token: 'tok', tenantId: 'tenant-1', offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    mockBoothGateway.isBoothOnline.mockReturnValue(true);

    const result = await controller.getBooths(TENANT_USER as any);

    expect(result).toHaveLength(1);
    expect(result[0].isOnline).toBe(true);
    expect(result[0].id).toBe('b-1');
  });

  it('POST /tenant/booths creates booth with generated token', async () => {
    const created = { id: 'b-new', name: 'New Booth', token: 'generated', tenantId: 'tenant-1', offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true, createdAt: new Date(), updatedAt: new Date() };
    mockPrisma.booth.create.mockResolvedValueOnce(created);

    const result = await controller.createBooth({ name: 'New Booth', offlineMode: 'BLOCK' } as any, TENANT_USER as any);

    expect(mockPrisma.booth.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'New Booth', tenantId: 'tenant-1' }),
    });
    expect(result.id).toBe('b-new');
  });
});
```

- [ ] **Step 2: Run — verify new tests fail**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: 2 new tests FAIL (`getBooths is not a function`)

- [ ] **Step 3: Add booth methods to TenantController**

Add after the `getMetrics` method in `apps/api/src/controllers/tenant.controller.ts`:

```typescript
  @Get('booths')
  async getBooths(@Request() req: AuthReq): Promise<IBoothWithStatus[]> {
    const { tenantId } = req.user;
    const booths = await this.prisma.booth.findMany({ where: { tenantId } });
    return booths.map((b) => ({
      ...b,
      offlineMode: b.offlineMode as any,
      isOnline: this.boothGateway.isBoothOnline(b.id),
    }));
  }

  @Post('booths')
  async createBooth(
    @Body() body: { name: string; offlineMode?: string },
    @Request() req: AuthReq,
  ) {
    const { tenantId } = req.user;
    return this.prisma.booth.create({
      data: {
        name: body.name,
        token: randomUUID(),
        tenantId,
        offlineMode: body.offlineMode ?? 'BLOCK',
      },
    });
  }
```

- [ ] **Step 4: Run — verify all tests pass**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): add GET /tenant/booths (with isOnline) and POST /tenant/booths"
```

---

## Task 6: TenantController — gallery endpoint + public photo endpoint

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/tenant.controller.spec.ts`
- Modify: `apps/api/src/controllers/photo.controller.ts`

- [ ] **Step 1: Add failing test for GET /tenant/photos**

Append to `tenant.controller.spec.ts`:

```typescript
describe('TenantController — gallery', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns paginated gallery sessions', async () => {
    const sessions = [
      {
        id: 'sess-1',
        photoUrls: ['https://s3.example.com/photo.jpg'],
        createdAt: new Date('2026-01-01'),
        event: { name: 'Wedding' },
        booth: { name: 'Booth 1' },
      },
    ];
    mockPrisma.photoSession.findMany.mockResolvedValueOnce(sessions);
    mockPrisma.photoSession.count.mockResolvedValueOnce(1);

    const result = await controller.getPhotos(TENANT_USER as any, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].sessionId).toBe('sess-1');
    expect(result.data[0].eventName).toBe('Wedding');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});
```

- [ ] **Step 2: Run — verify new test fails**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: new test FAIL

- [ ] **Step 3: Add getPhotos method to TenantController**

Add after `createBooth` in `apps/api/src/controllers/tenant.controller.ts`:

```typescript
  @Get('photos')
  async getPhotos(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<PaginatedResponse<IGallerySession>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const [sessions, total] = await Promise.all([
      this.prisma.photoSession.findMany({
        where: { booth: { tenantId } },
        include: { event: { select: { name: true } }, booth: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.photoSession.count({ where: { booth: { tenantId } } }),
    ]);

    return {
      data: sessions.map((s) => ({
        sessionId: s.id,
        photoUrls: s.photoUrls,
        eventName: s.event.name,
        boothName: s.booth.name,
        createdAt: s.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
```

- [ ] **Step 4: Add public photo endpoint to PhotoController**

Add a public GET endpoint to `apps/api/src/controllers/photo.controller.ts`:

```typescript
// Add at the top: import { Get, Param, NotFoundException } from '@nestjs/common';
// Add these imports to the existing @nestjs/common import:
import { Controller, Post, Get, Body, Param, Logger, NotFoundException } from '@nestjs/common';
// Add import:
import { PrismaService } from '../prisma/prisma.service';

// In the class, add PrismaService injection:
constructor(
  private readonly syncPhotoUseCase: SyncPhotoUseCase,
  private readonly prisma: PrismaService,
) {}

// Add new method:
@Get('public/:sessionId')
async getPublicSession(@Param('sessionId') sessionId: string) {
  const session = await this.prisma.photoSession.findUnique({
    where: { id: sessionId },
    select: { id: true, photoUrls: true },
  });
  if (!session) throw new NotFoundException('Session not found');
  return { sessionId: session.id, photoUrls: session.photoUrls };
}
```

- [ ] **Step 5: Run all tenant controller tests — verify they pass**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts apps/api/src/controllers/photo.controller.ts
git commit -m "feat(api): add GET /tenant/photos gallery endpoint + GET /photos/public/:sessionId"
```

---

## Task 7: TenantController — payments endpoint

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/tenant.controller.spec.ts`

- [ ] **Step 1: Add failing test for GET /tenant/payments**

Append to `tenant.controller.spec.ts`:

```typescript
describe('TenantController — payments', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('returns paginated payment records', async () => {
    const payments = [
      {
        id: 'pay-1',
        amount: { toNumber: () => 15 },
        status: 'APPROVED',
        createdAt: new Date('2026-01-01'),
        event: { name: 'Wedding' },
        booth: { name: 'Booth 1' },
      },
    ];
    mockPrisma.payment = { ...mockPrisma.payment, findMany: jest.fn().mockResolvedValueOnce(payments), count: jest.fn().mockResolvedValueOnce(1) };

    const result = await controller.getPayments(TENANT_USER as any, 1, 20);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('pay-1');
    expect(result.data[0].amount).toBe(15);
    expect(result.data[0].eventName).toBe('Wedding');
    expect(result.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run — verify new test fails**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: new test FAIL

- [ ] **Step 3: Add getPayments method to TenantController**

Add after `getPhotos` in `apps/api/src/controllers/tenant.controller.ts`:

```typescript
  @Get('payments')
  async getPayments(
    @Request() req: AuthReq,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<PaginatedResponse<IPaymentRecord>> {
    const { tenantId } = req.user;
    const skip = (Number(page) - 1) * Number(limit);

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { booth: { tenantId } },
        include: {
          event: { select: { name: true } },
          booth: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.payment.count({ where: { booth: { tenantId } } }),
    ]);

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status as any,
        eventName: p.event.name,
        boothName: p.booth.name,
        createdAt: p.createdAt,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): add GET /tenant/payments with pagination"
```

---

## Task 8: TenantController — settings endpoints

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/tenant.controller.spec.ts`

- [ ] **Step 1: Add failing tests for GET + PUT /tenant/settings**

Append to `tenant.controller.spec.ts`:

```typescript
describe('TenantController — settings', () => {
  let controller: TenantController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(TenantController);
  });

  it('GET /tenant/settings returns branding fields', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce({
      logoUrl: 'https://logo.png', primaryColor: '#1d4ed8', brandName: 'MyBrand',
    });

    const result = await controller.getSettings(TENANT_USER as any);

    expect(result.logoUrl).toBe('https://logo.png');
    expect(result.primaryColor).toBe('#1d4ed8');
    expect(result.brandName).toBe('MyBrand');
  });

  it('GET /tenant/settings throws NotFoundException when tenant not found', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);

    await expect(controller.getSettings(TENANT_USER as any)).rejects.toThrow(NotFoundException);
  });

  it('PUT /tenant/settings updates and returns branding fields', async () => {
    const updated = { logoUrl: null, primaryColor: '#ff0000', brandName: 'Updated' };
    mockPrisma.tenant.update.mockResolvedValueOnce(updated);

    const result = await controller.updateSettings({ primaryColor: '#ff0000', brandName: 'Updated' }, TENANT_USER as any);

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { primaryColor: '#ff0000', brandName: 'Updated' },
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
    expect(result.primaryColor).toBe('#ff0000');
  });
});
```

- [ ] **Step 2: Run — verify new tests fail**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: 3 new tests FAIL

- [ ] **Step 3: Add settings methods to TenantController**

Add after `getPayments` in `apps/api/src/controllers/tenant.controller.ts`:

```typescript
  @Get('settings')
  async getSettings(@Request() req: AuthReq): Promise<ITenantSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  @Put('settings')
  async updateSettings(
    @Body() body: UpdateTenantSettingsDto,
    @Request() req: AuthReq,
  ): Promise<ITenantSettings> {
    return this.prisma.tenant.update({
      where: { id: req.user.tenantId },
      data: body,
      select: { logoUrl: true, primaryColor: true, brandName: true },
    });
  }
```

- [ ] **Step 4: Run — verify all tests pass**

Run: `cd apps/api && npx jest --testPathPattern=tenant.controller.spec --no-coverage`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): add GET /tenant/settings and PUT /tenant/settings"
```

---

## Task 9: EventController — JWT auth fix

**Files:**
- Modify: `apps/api/src/controllers/event.controller.ts`
- Create: `apps/api/src/controllers/event.controller.spec.ts`

The current EventController uses `?tenantId` from query params. Replace with `JwtAuthGuard` + `req.user.tenantId`.

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/controllers/event.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EventController } from './event.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const USER = { user: { tenantId: 'tenant-1', email: 't@t.com' } };

describe('EventController (JWT)', () => {
  let controller: EventController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [EventController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(EventController);
  });

  it('findAll uses tenantId from JWT', async () => {
    mockPrisma.event.findMany.mockResolvedValueOnce([{ id: 'e-1', name: 'Wedding' }]);

    const result = await controller.findAll(USER as any);

    expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
    expect(result).toHaveLength(1);
  });

  it('create uses tenantId from JWT', async () => {
    mockPrisma.event.create.mockResolvedValueOnce({ id: 'e-new' });

    await controller.create({ name: 'Party', price: 20 } as any, USER as any);

    expect(mockPrisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-1' }) }),
    );
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

Run: `cd apps/api && npx jest --testPathPattern=event.controller.spec --no-coverage`
Expected: FAIL (EventController signature doesn't match)

- [ ] **Step 3: Rewrite EventController with JWT**

Replace full content of `apps/api/src/controllers/event.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/jwt.strategy';

interface AuthReq {
  user: RequestUser;
}

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Request() req: AuthReq) {
    return this.prisma.event.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() data: any, @Request() req: AuthReq) {
    return this.prisma.event.create({
      data: {
        name: data.name,
        price: data.price,
        photoCount: data.photoCount ?? 1,
        tenantId: req.user.tenantId,
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.prisma.event.update({
      where: { id },
      data: { name: data.name, price: data.price },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.prisma.event.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/api && npx jest --testPathPattern=event.controller.spec --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/controllers/event.controller.ts apps/api/src/controllers/event.controller.spec.ts
git commit -m "fix(api): EventController uses JwtAuthGuard, extracts tenantId from JWT instead of query param"
```

---

## Task 10: AppModule wiring + use-case updates

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/use-cases/process-webhook.use-case.ts`
- Modify: `apps/api/src/use-cases/sync-photo.use-case.ts`

- [ ] **Step 1: Register DashboardGateway in AppModule and inject BoothGateway into TenantController**

Replace full content of `apps/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { BoothGateway } from './gateways/booth.gateway';
import { DashboardGateway } from './gateways/dashboard.gateway';
import { MercadoPagoAdapter } from './adapters/mercadopago.adapter';
import { CreatePixPaymentUseCase } from './use-cases/create-pix-payment.use-case';
import { ProcessWebhookUseCase } from './use-cases/process-webhook.use-case';
import { PaymentExpirationProcessor } from './workers/payment-expiration.processor';
import { PaymentController } from './controllers/payment.controller';
import { S3StorageAdapter } from './adapters/storage/s3.adapter';
import { SyncPhotoUseCase } from './use-cases/sync-photo.use-case';
import { PhotoController } from './controllers/photo.controller';
import { TenantController } from './controllers/tenant.controller';
import { EventController } from './controllers/event.controller';
import { BoothsController } from './controllers/booths.controller';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({ name: 'payment-expiration' }),
  ],
  controllers: [
    PaymentController,
    PhotoController,
    TenantController,
    EventController,
    BoothsController,
  ],
  providers: [
    PrismaService,
    BoothGateway,
    DashboardGateway,
    MercadoPagoAdapter,
    CreatePixPaymentUseCase,
    ProcessWebhookUseCase,
    PaymentExpirationProcessor,
    S3StorageAdapter,
    SyncPhotoUseCase,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Update ProcessWebhookUseCase to broadcast to tenant dashboard room**

Replace full content of `apps/api/src/use-cases/process-webhook.use-case.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { DashboardGateway } from '../gateways/dashboard.gateway';
import { PaymentStatus } from '@packages/shared';

@Injectable()
export class ProcessWebhookUseCase {
  private readonly logger = new Logger(ProcessWebhookUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly boothGateway: BoothGateway,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async execute(payload: any) {
    const { action, data } = payload;
    if (action !== 'payment.updated') return;

    const externalId = data.id.toString();
    const payment = await this.prisma.payment.findUnique({
      where: { externalId },
      include: { booth: true },
    });

    if (!payment) {
      this.logger.warn(`Payment with externalId ${externalId} not found`);
      return;
    }
    if (payment.status === PaymentStatus.APPROVED) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.APPROVED },
    });

    const eventPayload = {
      paymentId: payment.id,
      transactionId: externalId,
      amount: Number(payment.amount),
    };

    // Notify totem
    this.boothGateway.sendPaymentApproved(payment.boothId, eventPayload);
    // Notify dashboard
    this.dashboardGateway.broadcastToTenant(
      payment.booth.tenantId,
      'payment_approved',
      eventPayload,
    );

    this.logger.log(`Payment approved and notified for booth: ${payment.boothId}`);
  }
}
```

- [ ] **Step 3: Update SyncPhotoUseCase to broadcast photo_synced to tenant dashboard room**

Replace full content of `apps/api/src/use-cases/sync-photo.use-case.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/storage/s3.adapter';
import { DashboardGateway } from '../gateways/dashboard.gateway';

@Injectable()
export class SyncPhotoUseCase {
  private readonly logger = new Logger(SyncPhotoUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Adapter: S3StorageAdapter,
    private readonly dashboardGateway: DashboardGateway,
  ) {}

  async execute(dto: { sessionId: string; photoBase64: string }) {
    this.logger.log(`Syncing photo for session: ${dto.sessionId}`);

    const photoUrl = await this.s3Adapter.uploadPhoto(dto.sessionId, dto.photoBase64);

    await this.prisma.photoSession.update({
      where: { id: dto.sessionId },
      data: { photoUrls: { push: photoUrl } },
    });

    const session = await this.prisma.photoSession.findUnique({
      where: { id: dto.sessionId },
      include: { booth: { select: { tenantId: true } } },
    });

    if (session) {
      this.dashboardGateway.broadcastToTenant(session.booth.tenantId, 'photo_synced', {
        sessionId: dto.sessionId,
        photoUrl,
        tenantId: session.booth.tenantId,
      });
    }

    return { success: true, url: photoUrl };
  }
}
```

- [ ] **Step 4: Run all API tests to verify nothing broke**

Run: `cd apps/api && npx jest --no-coverage`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/use-cases/process-webhook.use-case.ts apps/api/src/use-cases/sync-photo.use-case.ts
git commit -m "feat(api): wire DashboardGateway into AppModule and use-cases for real-time dashboard events"
```

---

## Task 11: Dashboard layout, routes, and socket updates

**Files:**
- Modify: `apps/dashboard/src/components/DashboardLayout.tsx`
- Modify: `apps/dashboard/src/App.tsx`
- Modify: `apps/dashboard/src/hooks/useDashboardSocket.ts`

- [ ] **Step 1: Update DashboardLayout — add Payments + Settings nav links + working logout**

Replace full content of `apps/dashboard/src/components/DashboardLayout.tsx`:

```tsx
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Image as ImageIcon, Smartphone, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col fixed h-full">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">P</div>
          <h1 className="text-xl font-bold tracking-tight">PhotoBooth OS</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarLink to="/" icon={LayoutDashboard} label="Início" />
          <SidebarLink to="/events" icon={Calendar} label="Eventos" />
          <SidebarLink to="/gallery" icon={ImageIcon} label="Galeria" />
          <SidebarLink to="/booths" icon={Smartphone} label="Cabines" />
          <SidebarLink to="/payments" icon={CreditCard} label="Pagamentos" />
          <SidebarLink to="/settings" icon={Settings} label="Configurações" />
        </nav>
        <div className="mt-auto pt-6 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
      <main className="ml-64 flex-1">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx — add /payments and /settings routes**

In `apps/dashboard/src/App.tsx`, replace the `AppContent` imports and routes section:

```tsx
import { BoothsPage } from './pages/BoothsPage';
import { GalleryPage } from './pages/GalleryPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
```

Replace the DashboardLayout routes block in `AppContent`:

```tsx
<DashboardLayout>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/events" element={<EventsPage />} />
    <Route path="/gallery" element={<GalleryPage />} />
    <Route path="/booths" element={<BoothsPage />} />
    <Route path="/payments" element={<PaymentsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>
</DashboardLayout>
```

- [ ] **Step 3: Update useDashboardSocket — JWT auth + new WS events**

Replace full content of `apps/dashboard/src/hooks/useDashboardSocket.ts`:

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useDashboardSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to Dashboard Real-time Engine');
    });

    socket.on('payment_approved', () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    });

    socket.on('session_completed', () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    socket.on('photo_synced', () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    });

    socket.on('booth_status', () => {
      queryClient.invalidateQueries({ queryKey: ['booths'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    });

    return () => { socket.disconnect(); };
  }, [queryClient]);
};
```

- [ ] **Step 4: Update App.tsx DashboardSocketInit to match new hook signature**

In `apps/dashboard/src/App.tsx`, update `DashboardSocketInit`:

```tsx
function DashboardSocketInit() {
  useDashboardSocket();
  return null;
}
```

Remove the `const { tenantId } = useAuth();` line from `DashboardSocketInit` since the hook now reads from localStorage directly.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/DashboardLayout.tsx apps/dashboard/src/App.tsx apps/dashboard/src/hooks/useDashboardSocket.ts
git commit -m "feat(dashboard): add Payments/Settings nav, working logout, JWT WS auth, photo_synced/booth_status listeners"
```

---

## Task 12: API hooks for new pages

**Files:**
- Create: `apps/dashboard/src/hooks/api/useBooths.ts`
- Create: `apps/dashboard/src/hooks/api/useGallery.ts`
- Create: `apps/dashboard/src/hooks/api/usePayments.ts`
- Create: `apps/dashboard/src/hooks/api/useSettings.ts`

- [ ] **Step 1: Create useBooths.ts**

Create `apps/dashboard/src/hooks/api/useBooths.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IBoothWithStatus } from '@packages/shared';

export const useBooths = () =>
  useQuery<IBoothWithStatus[]>({
    queryKey: ['booths'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/booths');
      return data;
    },
  });

export const useCreateBooth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; offlineMode?: string }) => {
      const { data } = await api.post('/tenant/booths', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booths'] });
    },
  });
};
```

- [ ] **Step 2: Create useGallery.ts**

Create `apps/dashboard/src/hooks/api/useGallery.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PaginatedResponse, IGallerySession } from '@packages/shared';

export const useGallery = (page = 1, limit = 20) =>
  useQuery<PaginatedResponse<IGallerySession>>({
    queryKey: ['gallery', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/tenant/photos', { params: { page, limit } });
      return data;
    },
  });
```

- [ ] **Step 3: Create usePayments.ts**

Create `apps/dashboard/src/hooks/api/usePayments.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { PaginatedResponse, IPaymentRecord } from '@packages/shared';

export const usePayments = (page = 1, limit = 20) =>
  useQuery<PaginatedResponse<IPaymentRecord>>({
    queryKey: ['payments', page, limit],
    queryFn: async () => {
      const { data } = await api.get('/tenant/payments', { params: { page, limit } });
      return data;
    },
  });
```

- [ ] **Step 4: Create useSettings.ts**

Create `apps/dashboard/src/hooks/api/useSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITenantSettings, UpdateTenantSettingsDto } from '@packages/shared';

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
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/hooks/api/useBooths.ts apps/dashboard/src/hooks/api/useGallery.ts apps/dashboard/src/hooks/api/usePayments.ts apps/dashboard/src/hooks/api/useSettings.ts
git commit -m "feat(dashboard): add useBooths, useGallery, usePayments, useSettings hooks"
```

---

## Task 13: Home.tsx — real KPIs

**Files:**
- Modify: `apps/dashboard/src/pages/Home.tsx`

- [ ] **Step 1: Replace hardcoded KPI values with real metrics data**

Replace full content of `apps/dashboard/src/pages/Home.tsx`:

```tsx
import React from 'react';
import { useMetrics } from '../hooks/api/useMetrics';
import { TrendingUp, Users, DollarSign, Camera } from 'lucide-react';

const MetricCard = ({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  loading: boolean;
}) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
    </div>
    {loading ? (
      <div className="h-8 w-24 bg-gray-100 animate-pulse rounded"></div>
    ) : (
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    )}
    <p className="text-sm text-gray-500 font-medium mt-1">{title}</p>
  </div>
);

export const Home: React.FC = () => {
  const { data: metrics, isLoading } = useMetrics();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Visão Geral</h2>
        <p className="text-gray-500">Bem-vindo ao seu painel de controle.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Faturamento Total"
          value={
            metrics?.totalRevenue != null
              ? `R$ ${Number(metrics.totalRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : 'R$ 0,00'
          }
          icon={DollarSign}
          color="bg-blue-600"
          loading={isLoading}
        />
        <MetricCard
          title="Sessões de Fotos"
          value={metrics?.totalSessions ?? 0}
          icon={Camera}
          color="bg-purple-600"
          loading={isLoading}
        />
        <MetricCard
          title="Cabines Online"
          value={metrics?.activeBooths ?? 0}
          icon={Users}
          color="bg-orange-600"
          loading={isLoading}
        />
        <MetricCard
          title="Taxa de Conversão"
          value={metrics?.conversionRate != null ? `${metrics.conversionRate}%` : '0%'}
          icon={TrendingUp}
          color="bg-green-600"
          loading={isLoading}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/Home.tsx
git commit -m "feat(dashboard): Home.tsx shows real activeBooths and conversionRate from API"
```

---

## Task 14: BoothsPage

**Files:**
- Create: `apps/dashboard/src/pages/BoothsPage.tsx`
- Create: `apps/dashboard/src/pages/BoothsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/pages/BoothsPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoothsPage } from './BoothsPage';

vi.mock('../hooks/api/useBooths', () => ({
  useBooths: () => ({
    data: [
      { id: 'b-1', name: 'Cabine Salão', isOnline: true, token: 'tok-1', offlineMode: 'BLOCK' },
      { id: 'b-2', name: 'Cabine Jardim', isOnline: false, token: 'tok-2', offlineMode: 'DEMO' },
    ],
    isLoading: false,
  }),
  useCreateBooth: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('BoothsPage', () => {
  it('renders list of booths with online/offline badges', () => {
    render(<BoothsPage />);
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
    expect(screen.getByText('Cabine Jardim')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows create modal when "Nova Cabine" is clicked', async () => {
    render(<BoothsPage />);
    fireEvent.click(screen.getByText('Nova Cabine'));
    await waitFor(() => {
      expect(screen.getByText('Cadastrar Nova Cabine')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

Run: `cd apps/dashboard && npx vitest run src/pages/BoothsPage.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement BoothsPage**

Create `apps/dashboard/src/pages/BoothsPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useBooths, useCreateBooth } from '../hooks/api/useBooths';
import { Plus, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-react';

export const BoothsPage: React.FC = () => {
  const { data: booths, isLoading } = useBooths();
  const createMutation = useCreateBooth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', offlineMode: 'BLOCK' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form, {
      onSuccess: () => {
        setIsModalOpen(false);
        setForm({ name: '', offlineMode: 'BLOCK' });
      },
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cabines</h2>
          <p className="text-gray-500">Gerencie seus dispositivos fotográficos.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Nova Cabine
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {booths?.map((booth) => (
            <div key={booth.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Smartphone size={24} className="text-gray-600" />
                </div>
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                    booth.isOnline
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {booth.isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                  {booth.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{booth.name}</h3>
              <p className="text-sm text-gray-400 mt-1 font-mono truncate">{booth.token}</p>
              <p className="text-xs text-gray-400 mt-2">Modo offline: {booth.offlineMode}</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Cadastrar Nova Cabine</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="Ex: Cabine do Salão"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modo Offline</label>
                <select
                  value={form.offlineMode}
                  onChange={(e) => setForm({ ...form, offlineMode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="BLOCK">Bloquear</option>
                  <option value="DEMO">Demonstração</option>
                  <option value="CREDITS">Créditos</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar Cabine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/dashboard && npx vitest run src/pages/BoothsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/BoothsPage.tsx apps/dashboard/src/pages/BoothsPage.test.tsx
git commit -m "feat(dashboard): add BoothsPage with online/offline status and create modal"
```

---

## Task 15: GalleryPage

**Files:**
- Create: `apps/dashboard/src/pages/GalleryPage.tsx`
- Create: `apps/dashboard/src/pages/GalleryPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/pages/GalleryPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GalleryPage } from './GalleryPage';

vi.mock('../hooks/api/useGallery', () => ({
  useGallery: () => ({
    data: {
      data: [
        {
          sessionId: 'sess-1',
          photoUrls: ['https://s3.example.com/p1.jpg', 'https://s3.example.com/p2.jpg'],
          eventName: 'Casamento João',
          boothName: 'Cabine Salão',
          createdAt: new Date('2026-01-15T10:30:00').toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    },
    isLoading: false,
  }),
}));

describe('GalleryPage', () => {
  it('renders session photos', () => {
    render(<GalleryPage />);
    expect(screen.getByText('Casamento João')).toBeTruthy();
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
  });

  it('shows photo count badge', () => {
    render(<GalleryPage />);
    expect(screen.getByText('2 fotos')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

Run: `cd apps/dashboard && npx vitest run src/pages/GalleryPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement GalleryPage**

Create `apps/dashboard/src/pages/GalleryPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useGallery } from '../hooks/api/useGallery';
import { Loader2, ChevronLeft, ChevronRight, Image } from 'lucide-react';

export const GalleryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGallery(page, 20);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Galeria de Fotos</h2>
        <p className="text-gray-500">Todas as sessões realizadas nas suas cabines.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <Image size={48} className="mb-4 opacity-30" />
          <p>Nenhuma sessão registrada ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data.map((session) => (
              <div
                key={session.sessionId}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {session.photoUrls[0] ? (
                  <img
                    src={session.photoUrls[0]}
                    alt={`Sessão ${session.sessionId}`}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <Image size={32} className="text-gray-300" />
                  </div>
                )}
                <div className="p-4">
                  <p className="font-semibold text-gray-900 truncate">{session.eventName}</p>
                  <p className="text-sm text-gray-500">{session.boothName}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-1 rounded-full">
                      {session.photoUrls.length} fotos
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data && data.total > data.limit && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {Math.ceil(data.total / data.limit)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.total / data.limit)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/dashboard && npx vitest run src/pages/GalleryPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/GalleryPage.tsx apps/dashboard/src/pages/GalleryPage.test.tsx
git commit -m "feat(dashboard): add GalleryPage with photo sessions grid and pagination"
```

---

## Task 16: PaymentsPage + CSV export

**Files:**
- Create: `apps/dashboard/src/pages/PaymentsPage.tsx`
- Create: `apps/dashboard/src/pages/PaymentsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/pages/PaymentsPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentsPage } from './PaymentsPage';

const mockPayments = {
  data: [
    {
      id: 'pay-1',
      amount: 15,
      status: 'APPROVED',
      eventName: 'Casamento João',
      boothName: 'Cabine Salão',
      createdAt: new Date('2026-01-15').toISOString(),
    },
    {
      id: 'pay-2',
      amount: 15,
      status: 'EXPIRED',
      eventName: 'Casamento João',
      boothName: 'Cabine Salão',
      createdAt: new Date('2026-01-15').toISOString(),
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

vi.mock('../hooks/api/usePayments', () => ({
  usePayments: () => ({ data: mockPayments, isLoading: false }),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

describe('PaymentsPage', () => {
  it('renders payment rows', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('Casamento João')).toBeTruthy();
    expect(screen.getAllByText('Casamento João')).toHaveLength(2);
  });

  it('shows APPROVED status badge', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('APROVADO')).toBeTruthy();
    expect(screen.getByText('EXPIRADO')).toBeTruthy();
  });

  it('renders export CSV button', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('Exportar CSV')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

Run: `cd apps/dashboard && npx vitest run src/pages/PaymentsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement PaymentsPage**

Create `apps/dashboard/src/pages/PaymentsPage.tsx`:

```tsx
import React, { useState } from 'react';
import { usePayments } from '../hooks/api/usePayments';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { IPaymentRecord } from '@packages/shared';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  APPROVED: { label: 'APROVADO', className: 'bg-green-100 text-green-700' },
  PENDING: { label: 'PENDENTE', className: 'bg-yellow-100 text-yellow-700' },
  EXPIRED: { label: 'EXPIRADO', className: 'bg-gray-100 text-gray-500' },
  REJECTED: { label: 'REJEITADO', className: 'bg-red-100 text-red-700' },
};

function exportToCsv(payments: IPaymentRecord[]) {
  const header = 'Data,Evento,Cabine,Valor,Status';
  const rows = payments.map((p) =>
    [
      new Date(p.createdAt).toLocaleDateString('pt-BR'),
      p.eventName,
      p.boothName,
      `R$ ${p.amount.toFixed(2)}`,
      p.status,
    ].join(','),
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pagamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const PaymentsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePayments(page, 20);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pagamentos</h2>
          <p className="text-gray-500">Histórico de todas as transações.</p>
        </div>
        <button
          onClick={() => data && exportToCsv(data.data)}
          disabled={!data || data.data.length === 0}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Data', 'Evento', 'Cabine', 'Valor', 'Status'].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data.map((payment) => {
                const status = STATUS_LABELS[payment.status] ?? { label: payment.status, className: 'bg-gray-100 text-gray-500' };
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{payment.eventName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{payment.boothName}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      R$ {payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data && data.total > data.limit && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">{data.total} transações no total</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600">Página {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.total / data.limit)}
                  className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/dashboard && npx vitest run src/pages/PaymentsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/PaymentsPage.tsx apps/dashboard/src/pages/PaymentsPage.test.tsx
git commit -m "feat(dashboard): add PaymentsPage with status badges, pagination, and CSV export"
```

---

## Task 17: SettingsPage

**Files:**
- Create: `apps/dashboard/src/pages/SettingsPage.tsx`
- Create: `apps/dashboard/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/pages/SettingsPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

const mockMutate = vi.fn();

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: () => ({
    data: { logoUrl: null, primaryColor: '#1d4ed8', brandName: 'MyBrand' },
    isLoading: false,
  }),
  useUpdateSettings: () => ({ mutate: mockMutate, isPending: false }),
}));

describe('SettingsPage', () => {
  it('renders form with current settings values', () => {
    render(<SettingsPage />);
    const brandInput = screen.getByDisplayValue('MyBrand');
    expect(brandInput).toBeTruthy();
  });

  it('calls mutate on form submit', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Salvar Configurações'));
    expect(mockMutate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify tests fail**

Run: `cd apps/dashboard && npx vitest run src/pages/SettingsPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SettingsPage**

Create `apps/dashboard/src/pages/SettingsPage.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/api/useSettings';
import { Loader2, Save, Palette } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState({
    brandName: '',
    primaryColor: '#1d4ed8',
    logoUrl: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        brandName: settings.brandName ?? '',
        primaryColor: settings.primaryColor ?? '#1d4ed8',
        logoUrl: settings.logoUrl ?? '',
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      brandName: form.brandName || null,
      primaryColor: form.primaryColor || null,
      logoUrl: form.logoUrl || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500">White-label e identidade visual da sua marca.</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Palette size={20} className="text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Identidade Visual</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Marca
            </label>
            <input
              type="text"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="Ex: Estúdio Silva Fotos"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cor Principal
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none font-mono text-sm"
                placeholder="#1d4ed8"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL do Logo (PNG/SVG)
            </label>
            <input
              type="url"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="https://s3.amazonaws.com/seu-logo.png"
            />
            {form.logoUrl && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg inline-block">
                <img src={form.logoUrl} alt="Preview" className="h-12 object-contain" />
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Salvar Configurações
            </button>
            {updateMutation.isSuccess && (
              <p className="mt-3 text-sm text-green-600 font-medium">Configurações salvas!</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run — verify tests pass**

Run: `cd apps/dashboard && npx vitest run src/pages/SettingsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/SettingsPage.tsx apps/dashboard/src/pages/SettingsPage.test.tsx
git commit -m "feat(dashboard): add SettingsPage for white-label brand configuration"
```

---

## Task 18: GuestPhoto — real API

**Files:**
- Modify: `apps/dashboard/src/pages/GuestPhoto.tsx`

- [ ] **Step 1: Replace mock URL with real API call**

Replace full content of `apps/dashboard/src/pages/GuestPhoto.tsx`:

```tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Instagram, Send, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const GuestPhoto: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data, isLoading } = useQuery<{ sessionId: string; photoUrls: string[] }>({
    queryKey: ['guest-photo', sessionId],
    queryFn: async () => {
      const { data } = await axios.get(`${API_URL}/photos/public/${sessionId}`);
      return data;
    },
    enabled: !!sessionId,
    retry: false,
  });

  const primaryPhotoUrl = data?.photoUrls[0];

  const handleDownload = async () => {
    if (!primaryPhotoUrl) return;
    const response = await fetch(primaryPhotoUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photobooth-${sessionId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-6 font-sans">
      <header className="w-full max-w-md flex justify-between items-center py-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">P</div>
          <span className="font-bold tracking-tight text-lg">PhotoBooth OS</span>
        </div>
        <span className="text-xs text-neutral-500 font-mono uppercase tracking-widest">
          {sessionId?.slice(0, 8)}
        </span>
      </header>

      <main className="flex-1 w-full max-w-md flex flex-col gap-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-white" size={32} />
          </div>
        ) : primaryPhotoUrl ? (
          <>
            <div className="relative group animate-in fade-in zoom-in duration-700">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
                <img
                  src={primaryPhotoUrl}
                  alt="Sua Foto"
                  className="w-full aspect-[4/5] object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleDownload}
                className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-lg"
              >
                <Download size={24} strokeWidth={3} />
                BAIXAR FOTO
              </button>
              <div className="grid grid-cols-2 gap-4">
                <button className="bg-neutral-900 border border-neutral-800 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all">
                  <Instagram size={20} className="text-pink-500" />
                  Instagram
                </button>
                <button className="bg-neutral-900 border border-neutral-800 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold active:scale-95 transition-all">
                  <Send size={20} className="text-blue-400" />
                  WhatsApp
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-neutral-400">Foto não encontrada.</p>
        )}

        <p className="text-center text-neutral-500 text-sm mt-4 px-6 leading-relaxed">
          Obrigado por celebrar conosco! Suas memórias foram capturadas com sucesso.
        </p>
      </main>

      <footer className="py-10 text-neutral-700 text-xs uppercase tracking-[0.2em] font-medium">
        Powered by PhotoBooth OS
      </footer>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/dashboard && npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/pages/GuestPhoto.tsx
git commit -m "feat(dashboard): GuestPhoto fetches real photo from GET /photos/public/:sessionId"
```

---

## Final verification

- [ ] **Run all API tests**

Run: `cd apps/api && npx jest --no-coverage`
Expected: all tests PASS

- [ ] **Run all dashboard tests**

Run: `cd apps/dashboard && npx vitest run`
Expected: all tests PASS

- [ ] **TypeScript clean on both apps**

Run: `cd apps/api && npx tsc --noEmit && cd ../dashboard && npx tsc --noEmit`
Expected: no errors

---

## Self-review

### Spec coverage
- [x] `/booths` page — list with online/offline status, create modal → Tasks 14 + 5
- [x] `/gallery` page — photo grid + live updates (photo_synced WS) → Tasks 15 + 11
- [x] `/payments` page — history table + CSV export → Task 16
- [x] `/settings` page — white-label config → Task 17
- [x] Real KPIs in Home.tsx (conversionRate, activeBooths) → Tasks 4 + 13
- [x] API `GET /metrics` with conversionRate + activeBooths → Task 4
- [x] API `GET /booths` + `POST /booths` → Task 5
- [x] API `GET /photos` gallery → Task 6
- [x] API `GET /payments` with pagination → Task 7
- [x] API `GET/PUT /tenant/settings` → Task 8
- [x] JWT auth on EventController → Task 9
- [x] DashboardGateway for real-time events → Task 2
- [x] BoothGateway emits booth_status to dashboard → Task 3
- [x] GuestPhoto uses real API → Task 18
- [x] Logout button wired → Task 11

### Placeholder scan
None found — all steps contain actual code.

### Type consistency
- `IBoothWithStatus` defined in Task 1, used in Task 5 (controller) and Task 11 (useBooths hook)
- `PaginatedResponse<T>` defined in Task 1, used in Tasks 6, 7 (controller) and Tasks 12, 13 (hooks)
- `IGallerySession` defined in Task 1, returned by `getPhotos`, consumed by `useGallery` and `GalleryPage`
- `IPaymentRecord` defined in Task 1, returned by `getPayments`, consumed by `usePayments` and `PaymentsPage`
- `ITenantSettings` / `UpdateTenantSettingsDto` defined in Task 1, used in Task 8 (controller) and Task 12 (useSettings)
- `RequestUser` imported from `../auth/jwt.strategy` in Tasks 4, 5, 9 — already exists in codebase
- `randomUUID` from `crypto` used in Task 5 — Node.js 18+ built-in
- `DashboardGateway.broadcastToTenant` defined in Task 2, called in Tasks 3, 10 — signature matches
