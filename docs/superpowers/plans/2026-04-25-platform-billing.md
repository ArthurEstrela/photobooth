# Platform Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge tenants R$200/booth/month (configurable) via Mercado Pago PIX, auto-suspend non-payers after 7-day grace period, and auto-reactivate on payment — with totem lock screen and dashboard billing wall.

**Architecture:** Two Prisma enums (`SubStatus`, `InvoiceStatus`) and a `SubscriptionInvoice` table. Two BullMQ cron jobs (midnight: generate invoices; 9am: suspend overdue). Arthur's `MP_ACCESS_TOKEN` creates subscription PIX. Webhook `ProcessWebhookUseCase` checks `SubscriptionInvoice.externalId` first before the existing `Payment` table lookup. Critical payment endpoints return `402` when tenant is `SUSPENDED`. Dashboard shows a `BillingWall` overlay with 5s polling that auto-dismisses on payment. Totem shows a lock screen on `suspended: true` or any `402`.

**Tech Stack:** NestJS, Prisma enums, BullMQ cron, Mercado Pago PIX, React + TanStack Query `refetchInterval`.

---

## File Map

| File | Action |
|---|---|
| `apps/api/prisma/schema.prisma` | Modify — enums + Tenant fields + SubscriptionInvoice |
| `packages/shared/src/types.ts` | Modify — add `suspended?: boolean` to `BoothConfigDto` |
| `apps/api/src/auth/auth.service.ts` | Modify — set `billingAnchorDay` on register |
| `apps/api/src/auth/auth.service.spec.ts` | Modify — add billingAnchorDay test |
| `apps/api/src/use-cases/generate-invoices.use-case.ts` | Create |
| `apps/api/src/use-cases/generate-invoices.use-case.spec.ts` | Create |
| `apps/api/src/use-cases/check-overdue-invoices.use-case.ts` | Create |
| `apps/api/src/use-cases/check-overdue-invoices.use-case.spec.ts` | Create |
| `apps/api/src/workers/subscription-billing.processor.ts` | Create |
| `apps/api/src/use-cases/process-webhook.use-case.ts` | Modify — subscription invoice handling |
| `apps/api/src/use-cases/process-webhook.use-case.spec.ts` | Create |
| `apps/api/src/use-cases/create-pix-payment.use-case.ts` | Modify — 402 on SUSPENDED |
| `apps/api/src/use-cases/create-digital-payment.use-case.ts` | Modify — 402 on SUSPENDED |
| `apps/api/src/controllers/booths.controller.ts` | Modify — add `suspended` to config response |
| `apps/api/src/controllers/tenant.controller.ts` | Modify — add `GET /tenant/billing` |
| `apps/api/src/controllers/admin.controller.ts` | Modify — add `POST /admin/tenants/:id/billing` |
| `apps/api/src/app.module.ts` | Modify — register `subscription-billing` queue + processor |
| `apps/dashboard/src/hooks/api/useBilling.ts` | Create |
| `apps/dashboard/src/components/BillingWall.tsx` | Create |
| `apps/dashboard/src/pages/BillingPage.tsx` | Create |
| `apps/dashboard/src/components/DashboardLayout.tsx` | Modify — render `<BillingWall />` |
| `apps/dashboard/src/App.tsx` | Modify — add `/billing` route |
| `apps/totem/src/App.tsx` | Modify — show lock screen when suspended |

---

## Task 1: Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add enums to schema.prisma**

Open `apps/api/prisma/schema.prisma`. Add these two enums before the `model Plan` block:

```prisma
enum SubStatus {
  ACTIVE
  SUSPENDED
  TRIAL
}

enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
}
```

- [ ] **Step 2: Add billing fields to Tenant model**

In the `Tenant` model, add after `mpConnectedAt`:

```prisma
  subscriptionStatus   SubStatus @default(ACTIVE)
  pricePerBooth        Decimal   @default(200)
  billingAnchorDay     Int       @default(1)
  subscriptionInvoices SubscriptionInvoice[]
```

- [ ] **Step 3: Add SubscriptionInvoice model**

Add this model at the end of `schema.prisma`:

```prisma
model SubscriptionInvoice {
  id            String        @id @default(uuid())
  tenantId      String
  tenant        Tenant        @relation(fields: [tenantId], references: [id])
  boothCount    Int
  pricePerBooth Decimal
  amount        Decimal
  dueDate       DateTime
  status        InvoiceStatus @default(PENDING)
  externalId    String?       @unique
  qrCode        String?
  qrCodeBase64  String?
  paidAt        DateTime?
  createdAt     DateTime      @default(now())
}
```

- [ ] **Step 4: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add-subscription-billing
```

Expected output: `Applying migration '..._add_subscription_billing'` — Your database is now in sync.

- [ ] **Step 5: Add `suspended` to BoothConfigDto in shared types**

Open `packages/shared/src/types.ts`. Find `BoothConfigDto` and add the `suspended` field:

```typescript
export interface BoothConfigDto {
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  suspended: boolean;
  branding: BoothBranding;
  devices: {
    selectedCamera: string | null;
    selectedPrinter: string | null;
    maintenancePin: string | null;
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma packages/shared/src/types.ts
git commit -m "feat(api): add subscription billing schema — enums, SubscriptionInvoice, Tenant fields"
```

---

## Task 2: AuthService — Set billingAnchorDay on Register

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Add failing test**

Open `apps/api/src/auth/auth.service.spec.ts`. Add inside `describe('register', ...)`:

```typescript
it('sets billingAnchorDay from signup date (capped at 28)', async () => {
  mockPrisma.tenant.findUnique.mockResolvedValue(null);
  mockPrisma.tenant.create.mockResolvedValue({ id: 'tenant-1', email: 'test@test.com' });

  await service.register({ name: 'Test', email: 'test@test.com', password: '12345678' });

  const createCall = mockPrisma.tenant.create.mock.calls[0][0];
  expect(createCall.data.billingAnchorDay).toBeGreaterThanOrEqual(1);
  expect(createCall.data.billingAnchorDay).toBeLessThanOrEqual(28);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx jest --testPathPattern=auth.service --no-coverage
```

Expected: FAIL — `billingAnchorDay` not in create data

- [ ] **Step 3: Update register() in AuthService**

In `apps/api/src/auth/auth.service.ts`, find the `register` method and update the `tenant.create` call to include `billingAnchorDay`:

```typescript
async register(dto: RegisterDto): Promise<AuthResponseDto> {
  const existing = await this.prisma.tenant.findUnique({ where: { email: dto.email } });
  if (existing) throw new ConflictException('Email já cadastrado');

  const passwordHash = await bcrypt.hash(dto.password, 10);
  const billingAnchorDay = Math.min(new Date().getDate(), 28);

  const tenant = await this.prisma.tenant.create({
    data: { name: dto.name, email: dto.email, passwordHash, billingAnchorDay },
  });

  return this.buildToken(tenant);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=auth.service --no-coverage
```

Expected: PASS, all existing + new test passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): set billingAnchorDay on tenant registration"
```

---

## Task 3: GenerateInvoicesUseCase

**Files:**
- Create: `apps/api/src/use-cases/generate-invoices.use-case.spec.ts`
- Create: `apps/api/src/use-cases/generate-invoices.use-case.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/use-cases/generate-invoices.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { GenerateInvoicesUseCase } from './generate-invoices.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';

const mockPrisma = {
  tenant: { findMany: jest.fn() },
  subscriptionInvoice: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockMpAdapter = { createPixPayment: jest.fn() };

const TENANT = {
  id: 'tenant-1',
  pricePerBooth: { valueOf: () => 200 },
  _count: { booths: 3 },
};

const MP_RESPONSE = {
  externalId: 99999,
  qrCode: 'qr-string',
  qrCodeBase64: 'base64-string',
};

describe('GenerateInvoicesUseCase', () => {
  let useCase: GenerateInvoicesUseCase;
  const originalEnv = process.env.MP_ACCESS_TOKEN;

  beforeEach(async () => {
    process.env.MP_ACCESS_TOKEN = 'test-mp-token';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateInvoicesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MercadoPagoAdapter, useValue: mockMpAdapter },
      ],
    }).compile();
    useCase = module.get<GenerateInvoicesUseCase>(GenerateInvoicesUseCase);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.MP_ACCESS_TOKEN = originalEnv;
  });

  it('generates invoice and PIX for tenant with booths', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([TENANT]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null); // no existing invoice
    mockPrisma.subscriptionInvoice.create.mockResolvedValue({ id: 'inv-1' });
    mockMpAdapter.createPixPayment.mockResolvedValue(MP_RESPONSE);
    mockPrisma.subscriptionInvoice.update.mockResolvedValue({});

    await useCase.execute();

    expect(mockMpAdapter.createPixPayment).toHaveBeenCalledWith(
      'test-mp-token',
      expect.objectContaining({ amount: 600, description: expect.stringContaining('3 cabine') }),
    );
    expect(mockPrisma.subscriptionInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ externalId: '99999', qrCode: 'qr-string' }),
      }),
    );
  });

  it('skips tenant if invoice already exists this period (idempotency)', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([TENANT]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({ id: 'existing-inv' });

    await useCase.execute();

    expect(mockMpAdapter.createPixPayment).not.toHaveBeenCalled();
  });

  it('skips tenant with 0 booths', async () => {
    const tenantNoBooths = { ...TENANT, _count: { booths: 0 } };
    mockPrisma.tenant.findMany.mockResolvedValue([tenantNoBooths]);
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

    await useCase.execute();

    expect(mockPrisma.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(mockMpAdapter.createPixPayment).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=generate-invoices --no-coverage
```

Expected: FAIL with "Cannot find module './generate-invoices.use-case'"

- [ ] **Step 3: Implement GenerateInvoicesUseCase**

Create `apps/api/src/use-cases/generate-invoices.use-case.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoAdapter } from '../adapters/mercadopago.adapter';

@Injectable()
export class GenerateInvoicesUseCase {
  private readonly logger = new Logger(GenerateInvoicesUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpAdapter: MercadoPagoAdapter,
  ) {}

  async execute(): Promise<void> {
    const today = new Date().getDate();

    const tenants = await this.prisma.tenant.findMany({
      where: { billingAnchorDay: today, subscriptionStatus: 'ACTIVE' },
      include: { _count: { select: { booths: true } } },
    });

    for (const tenant of tenants) {
      // Idempotency: skip if invoice already generated this billing period
      const periodStart = new Date();
      periodStart.setDate(today);
      periodStart.setHours(0, 0, 0, 0);

      const existing = await this.prisma.subscriptionInvoice.findFirst({
        where: { tenantId: tenant.id, createdAt: { gte: periodStart } },
      });
      if (existing) continue;

      const boothCount = tenant._count.booths;
      if (boothCount === 0) continue;

      const amount = Number(tenant.pricePerBooth) * boothCount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoice = await this.prisma.subscriptionInvoice.create({
        data: {
          tenantId: tenant.id,
          boothCount,
          pricePerBooth: tenant.pricePerBooth,
          amount,
          dueDate,
        },
      });

      try {
        const accessToken = process.env.MP_ACCESS_TOKEN!;
        const mpResponse = await this.mpAdapter.createPixPayment(accessToken, {
          amount,
          description: `Assinatura PhotoBooth — ${boothCount} cabine(s)`,
          metadata: { type: 'subscription', tenantId: tenant.id, invoiceId: invoice.id },
        });

        await this.prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: {
            externalId: mpResponse.externalId.toString(),
            qrCode: mpResponse.qrCode,
            qrCodeBase64: mpResponse.qrCodeBase64,
          },
        });

        this.logger.log(`Invoice generated for tenant ${tenant.id}: R$${amount}`);
      } catch (err: any) {
        this.logger.error(`Failed to generate PIX for tenant ${tenant.id}: ${err?.message}`);
        // Invoice record stays without externalId — will be visible in billing page
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=generate-invoices --no-coverage
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/generate-invoices.use-case.ts apps/api/src/use-cases/generate-invoices.use-case.spec.ts
git commit -m "feat(api): add GenerateInvoicesUseCase for monthly subscription billing"
```

---

## Task 4: CheckOverdueInvoicesUseCase

**Files:**
- Create: `apps/api/src/use-cases/check-overdue-invoices.use-case.spec.ts`
- Create: `apps/api/src/use-cases/check-overdue-invoices.use-case.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/use-cases/check-overdue-invoices.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CheckOverdueInvoicesUseCase } from './check-overdue-invoices.use-case';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  subscriptionInvoice: { findMany: jest.fn() },
  tenant: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

describe('CheckOverdueInvoicesUseCase', () => {
  let useCase: CheckOverdueInvoicesUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckOverdueInvoicesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<CheckOverdueInvoicesUseCase>(CheckOverdueInvoicesUseCase);
    jest.clearAllMocks();
  });

  it('suspends tenants with overdue PENDING invoices', async () => {
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([
      { id: 'inv-1', tenantId: 'tenant-1' },
      { id: 'inv-2', tenantId: 'tenant-2' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([]);

    await useCase.execute();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
  });

  it('does nothing when no overdue invoices exist', async () => {
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockResolvedValue([]);

    await useCase.execute();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=check-overdue-invoices --no-coverage
```

Expected: FAIL with "Cannot find module './check-overdue-invoices.use-case'"

- [ ] **Step 3: Implement CheckOverdueInvoicesUseCase**

Create `apps/api/src/use-cases/check-overdue-invoices.use-case.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckOverdueInvoicesUseCase {
  private readonly logger = new Logger(CheckOverdueInvoicesUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<void> {
    const now = new Date();

    const overdueInvoices = await this.prisma.subscriptionInvoice.findMany({
      where: { status: 'PENDING', dueDate: { lt: now } },
      select: { id: true, tenantId: true },
    });

    if (overdueInvoices.length === 0) {
      await this.prisma.$transaction([]);
      return;
    }

    const tenantIds = [...new Set(overdueInvoices.map((i) => i.tenantId))];

    await this.prisma.$transaction([
      this.prisma.subscriptionInvoice.updateMany({
        where: { id: { in: overdueInvoices.map((i) => i.id) } },
        data: { status: 'OVERDUE' },
      }),
      this.prisma.tenant.updateMany({
        where: { id: { in: tenantIds } },
        data: { subscriptionStatus: 'SUSPENDED' },
      }),
    ]);

    this.logger.log(`Suspended ${tenantIds.length} tenant(s) for overdue invoices`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=check-overdue-invoices --no-coverage
```

Expected: PASS, 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/check-overdue-invoices.use-case.ts apps/api/src/use-cases/check-overdue-invoices.use-case.spec.ts
git commit -m "feat(api): add CheckOverdueInvoicesUseCase to suspend non-paying tenants"
```

---

## Task 5: SubscriptionBillingProcessor + AppModule Registration

**Files:**
- Create: `apps/api/src/workers/subscription-billing.processor.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create SubscriptionBillingProcessor**

Create `apps/api/src/workers/subscription-billing.processor.ts`:

```typescript
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { GenerateInvoicesUseCase } from '../use-cases/generate-invoices.use-case';
import { CheckOverdueInvoicesUseCase } from '../use-cases/check-overdue-invoices.use-case';

@Processor('subscription-billing')
@Injectable()
export class SubscriptionBillingProcessor implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionBillingProcessor.name);

  constructor(
    @InjectQueue('subscription-billing') private readonly queue: Queue,
    private readonly generateInvoices: GenerateInvoicesUseCase,
    private readonly checkOverdue: CheckOverdueInvoicesUseCase,
  ) {}

  async onModuleInit() {
    const jobs = await this.queue.getRepeatableJobs();
    if (!jobs.find((j) => j.name === 'generate-invoices')) {
      await this.queue.add('generate-invoices', {}, { repeat: { cron: '0 0 * * *' } });
      this.logger.log('Scheduled generate-invoices cron job (0 0 * * *)');
    }
    if (!jobs.find((j) => j.name === 'check-overdue')) {
      await this.queue.add('check-overdue', {}, { repeat: { cron: '0 9 * * *' } });
      this.logger.log('Scheduled check-overdue cron job (0 9 * * *)');
    }
  }

  @Process('generate-invoices')
  async handleGenerateInvoices(_job: Job) {
    this.logger.log('Running generate-invoices job');
    await this.generateInvoices.execute();
  }

  @Process('check-overdue')
  async handleCheckOverdue(_job: Job) {
    this.logger.log('Running check-overdue job');
    await this.checkOverdue.execute();
  }
}
```

- [ ] **Step 2: Register in AppModule**

Open `apps/api/src/app.module.ts`. Add these imports at the top:

```typescript
import { GenerateInvoicesUseCase } from './use-cases/generate-invoices.use-case';
import { CheckOverdueInvoicesUseCase } from './use-cases/check-overdue-invoices.use-case';
import { SubscriptionBillingProcessor } from './workers/subscription-billing.processor';
```

Add `subscription-billing` queue to the `BullModule.registerQueue` call:

```typescript
BullModule.registerQueue(
  { name: 'payment-expiration' },
  { name: 'subscription-billing' },
),
```

Add to the `providers` array:

```typescript
GenerateInvoicesUseCase,
CheckOverdueInvoicesUseCase,
SubscriptionBillingProcessor,
```

- [ ] **Step 3: Run all API tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass (ignore pre-existing booth.gateway failures)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/workers/subscription-billing.processor.ts apps/api/src/app.module.ts
git commit -m "feat(api): add SubscriptionBillingProcessor with daily cron jobs"
```

---

## Task 6: ProcessWebhookUseCase — Subscription Payment Handling

**Files:**
- Modify: `apps/api/src/use-cases/process-webhook.use-case.ts`
- Create: `apps/api/src/use-cases/process-webhook.use-case.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/use-cases/process-webhook.use-case.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProcessWebhookUseCase } from './process-webhook.use-case';
import { PrismaService } from '../prisma/prisma.service';
import { BoothGateway } from '../gateways/booth.gateway';
import { DashboardGateway } from '../gateways/dashboard.gateway';

const mockPrisma = {
  subscriptionInvoice: { findFirst: jest.fn(), update: jest.fn() },
  tenant: { update: jest.fn() },
  payment: { findFirst: jest.fn(), update: jest.fn() },
  photoSession: { create: jest.fn() },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockBoothGateway = { sendPaymentApproved: jest.fn(), sendPaymentExpired: jest.fn() };
const mockDashboardGateway = { broadcastToTenant: jest.fn() };

const SUBSCRIPTION_PAYLOAD = { action: 'payment.updated', data: { id: 'mp-sub-999' } };

describe('ProcessWebhookUseCase — subscription', () => {
  let useCase: ProcessWebhookUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessWebhookUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BoothGateway, useValue: mockBoothGateway },
        { provide: DashboardGateway, useValue: mockDashboardGateway },
      ],
    }).compile();
    useCase = module.get<ProcessWebhookUseCase>(ProcessWebhookUseCase);
    jest.clearAllMocks();
  });

  it('marks subscription invoice PAID and reactivates tenant', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      status: 'PENDING',
    });

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
    // Booth gateway should NOT be called for subscription payments
    expect(mockBoothGateway.sendPaymentApproved).not.toHaveBeenCalled();
  });

  it('is idempotent — does nothing for already-PAID subscription invoice', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      status: 'PAID',
    });

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('falls through to Payment table when no subscription invoice matches', async () => {
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
    mockPrisma.payment.findFirst.mockResolvedValue(null);

    await useCase.execute(SUBSCRIPTION_PAYLOAD);

    // No crash, just warns
    expect(mockPrisma.payment.findFirst).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=process-webhook.use-case --no-coverage
```

Expected: FAIL — subscription invoice check not implemented yet

- [ ] **Step 3: Update ProcessWebhookUseCase**

Replace the full contents of `apps/api/src/use-cases/process-webhook.use-case.ts`:

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

    // 1. Check SubscriptionInvoice first — subscription PIX are not in the Payment table
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { externalId },
    });
    if (invoice) {
      if (invoice.status === 'PAID') return; // idempotent
      await this.prisma.$transaction([
        this.prisma.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        }),
        this.prisma.tenant.update({
          where: { id: invoice.tenantId },
          data: { subscriptionStatus: 'ACTIVE' },
        }),
      ]);
      this.logger.log(`Subscription invoice ${invoice.id} paid — tenant ${invoice.tenantId} reactivated`);
      return;
    }

    // 2. Fall through to existing Payment table lookup (photobooth session payments)
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { externalId },
          ...(process.env.NODE_ENV !== 'production' ? [{ id: externalId }] : []),
        ],
      },
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

    if (payment.paymentType === 'DIGITAL') {
      this.logger.log(`Digital payment ${payment.id} approved`);
      return;
    }

    const photoSession = await this.prisma.photoSession.create({
      data: {
        paymentId: payment.id,
        boothId: payment.boothId,
        eventId: payment.eventId,
        photoUrls: [],
      },
    });

    const eventPayload = {
      paymentId: payment.id,
      boothId: payment.boothId,
      sessionId: photoSession.id,
    };

    this.boothGateway.sendPaymentApproved(payment.boothId, eventPayload);
    if (payment.booth) {
      this.dashboardGateway.broadcastToTenant(payment.booth.tenantId, 'payment_approved', eventPayload);
    } else {
      this.logger.warn(`Booth not found for payment ${payment.id} — dashboard not notified`);
    }

    this.logger.log(`Payment approved, PhotoSession ${photoSession.id} created for booth: ${payment.boothId}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=process-webhook.use-case --no-coverage
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/use-cases/process-webhook.use-case.ts apps/api/src/use-cases/process-webhook.use-case.spec.ts
git commit -m "feat(api): ProcessWebhookUseCase handles subscription invoice payments"
```

---

## Task 7: Hard 402 Block on Payment Use-Cases

**Files:**
- Modify: `apps/api/src/use-cases/create-pix-payment.use-case.ts`
- Modify: `apps/api/src/use-cases/create-digital-payment.use-case.ts`

- [ ] **Step 1: Add `tenant` mock and failing tests to existing spec files**

Open `apps/api/src/use-cases/create-pix-payment.use-case.spec.ts`.

Find the `mockPrisma` object at the top and add `tenant`:
```typescript
const mockPrisma = {
  booth: { findUnique: jest.fn() },
  event: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
  tenant: { findUnique: jest.fn() },  // ← add this line
};
```

In `beforeEach`, add a default mock return for `tenant.findUnique` (returns ACTIVE so existing tests keep passing):
```typescript
mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' });
```

Then add this test inside the existing `describe` block:
```typescript
it('throws 402 Payment Required when tenant subscription is SUSPENDED', async () => {
  mockMpOAuth.refreshIfNeeded.mockResolvedValue('token');
  mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'SUSPENDED' });

  await expect(
    useCase.execute({ boothId: 'booth-1', eventId: 'event-1', amount: 50, templateId: undefined }),
  ).rejects.toMatchObject({ status: 402 });
});
```

Open `apps/api/src/use-cases/create-digital-payment.use-case.spec.ts`.

Find the `mockPrisma` object and add `tenant`:
```typescript
const mockPrisma = {
  photoSession: { findUnique: jest.fn() },
  payment: { create: jest.fn() },
  tenant: { findUnique: jest.fn() },  // ← add this line
};
```

In `beforeEach`, add default mock:
```typescript
mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'ACTIVE' });
```

Then add:
```typescript
it('throws 402 Payment Required when tenant subscription is SUSPENDED', async () => {
  mockPrisma.tenant.findUnique.mockResolvedValue({ subscriptionStatus: 'SUSPENDED' });

  await expect(useCase.execute('session-1')).rejects.toMatchObject({ status: 402 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern="create-pix-payment|create-digital-payment" --no-coverage
```

Expected: FAIL — no 402 thrown yet

- [ ] **Step 3: Update CreatePixPaymentUseCase**

Open `apps/api/src/use-cases/create-pix-payment.use-case.ts`. Add `HttpException, HttpStatus` to imports from `@nestjs/common`. Then add the subscription check after the booth lookup:

```typescript
import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
```

After `const booth = await this.prisma.booth.findUnique({ where: { id: dto.boothId } });`, add:

```typescript
// Check subscription status
const tenantSub = await this.prisma.tenant.findUnique({
  where: { id: booth.tenantId },
  select: { subscriptionStatus: true },
});
if (tenantSub?.subscriptionStatus === 'SUSPENDED') {
  throw new HttpException('Assinatura suspensa', HttpStatus.PAYMENT_REQUIRED);
}
```

- [ ] **Step 4: Update CreateDigitalPaymentUseCase**

Open `apps/api/src/use-cases/create-digital-payment.use-case.ts`. Add `HttpException, HttpStatus` to imports. After `const session = await this.prisma.photoSession.findUnique(...)`, add the check:

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
```

After the `if (!session)` check, add:

```typescript
// Check subscription status
const tenantSub = await this.prisma.tenant.findUnique({
  where: { id: session.booth.tenantId },
  select: { subscriptionStatus: true },
});
if (tenantSub?.subscriptionStatus === 'SUSPENDED') {
  throw new HttpException('Assinatura suspensa', HttpStatus.PAYMENT_REQUIRED);
}
```

- [ ] **Step 5: Run all use-case tests**

```bash
cd apps/api && npx jest --testPathPattern="create-pix-payment|create-digital-payment" --no-coverage
```

Expected: PASS, all tests passing

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/use-cases/create-pix-payment.use-case.ts apps/api/src/use-cases/create-digital-payment.use-case.ts apps/api/src/use-cases/create-pix-payment.use-case.spec.ts apps/api/src/use-cases/create-digital-payment.use-case.spec.ts
git commit -m "feat(api): return 402 on payment endpoints when tenant subscription is SUSPENDED"
```

---

## Task 8: BoothsController — Add suspended Field

**Files:**
- Modify: `apps/api/src/controllers/booths.controller.ts`

- [ ] **Step 1: Update getConfig to include suspended**

Open `apps/api/src/controllers/booths.controller.ts`. The `booth.findFirst` already uses `include: { tenant: true }`. Update the return statement to add `suspended`:

```typescript
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
```

- [ ] **Step 2: Run API tests**

```bash
cd apps/api && npx jest --testPathPattern=booths.controller --no-coverage
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/booths.controller.ts
git commit -m "feat(api): add suspended field to booth config response"
```

---

## Task 9: TenantController — GET /tenant/billing and AdminController billing endpoint

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/controllers/admin.controller.ts`

- [ ] **Step 1: Add billing tests to tenant controller spec**

Open `apps/api/src/controllers/tenant.controller.spec.ts`. Add to `mockPrisma`:
```typescript
subscriptionInvoice: { findFirst: jest.fn() },
```

Add these test cases:

```typescript
describe('GET /tenant/billing', () => {
  it('returns ACTIVE status with null invoice when no pending invoice', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      subscriptionStatus: 'ACTIVE',
      pricePerBooth: 200,
      billingAnchorDay: 15,
      _count: { booths: 2 },
    });
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);

    const result = await controller.getBilling(TENANT_USER as any);

    expect(result.status).toBe('ACTIVE');
    expect(result.invoice).toBeNull();
    expect(result.boothCount).toBe(2);
  });

  it('returns SUSPENDED status with invoice when PENDING invoice exists', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      subscriptionStatus: 'SUSPENDED',
      pricePerBooth: 200,
      billingAnchorDay: 15,
      _count: { booths: 3 },
    });
    mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      amount: { valueOf: () => 600 },
      dueDate: new Date('2026-05-22'),
      status: 'OVERDUE',
      qrCode: 'qr',
      qrCodeBase64: 'b64',
    });

    const result = await controller.getBilling(TENANT_USER as any);

    expect(result.status).toBe('SUSPENDED');
    expect(result.invoice).not.toBeNull();
    expect(result.invoice!.amount).toBe(600);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=tenant.controller --no-coverage
```

Expected: FAIL — `getBilling` not a function

- [ ] **Step 3: Add getBilling to TenantController**

Open `apps/api/src/controllers/tenant.controller.ts`. Add this method after `getSettings`:

```typescript
@Get('billing')
async getBilling(@Request() req: AuthReq) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: req.user.tenantId },
    select: {
      subscriptionStatus: true,
      pricePerBooth: true,
      billingAnchorDay: true,
      _count: { select: { booths: true } },
    },
  });
  if (!tenant) throw new NotFoundException('Tenant not found');

  const pendingInvoice = await this.prisma.subscriptionInvoice.findFirst({
    where: {
      tenantId: req.user.tenantId,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    status: tenant.subscriptionStatus,
    pricePerBooth: Number(tenant.pricePerBooth),
    boothCount: tenant._count.booths,
    billingAnchorDay: tenant.billingAnchorDay,
    invoice: pendingInvoice
      ? {
          id: pendingInvoice.id,
          amount: Number(pendingInvoice.amount),
          dueDate: pendingInvoice.dueDate,
          status: pendingInvoice.status,
          qrCode: pendingInvoice.qrCode,
          qrCodeBase64: pendingInvoice.qrCodeBase64,
        }
      : null,
  };
}
```

- [ ] **Step 4: Add updateTenantBilling to AdminController**

Open `apps/api/src/controllers/admin.controller.ts`. The existing imports line is:
```typescript
import { Controller, Get, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
```
Add `Body` to this import:
```typescript
import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
```

Then add this method:

```typescript
@Post('tenants/:tenantId/billing')
async updateTenantBilling(
  @Param('tenantId') tenantId: string,
  @Body() body: { pricePerBooth?: number; subscriptionStatus?: string },
) {
  const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundException('Tenant not found');

  return this.prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(body.pricePerBooth !== undefined && { pricePerBooth: body.pricePerBooth }),
      ...(body.subscriptionStatus !== undefined && { subscriptionStatus: body.subscriptionStatus as any }),
    },
    select: { id: true, subscriptionStatus: true, pricePerBooth: true },
  });
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && npx jest --testPathPattern="tenant.controller|admin.controller" --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/controllers/admin.controller.ts apps/api/src/controllers/tenant.controller.spec.ts
git commit -m "feat(api): add GET /tenant/billing and POST /admin/tenants/:id/billing endpoints"
```

---

## Task 10: Dashboard — useBilling Hook

**Files:**
- Create: `apps/dashboard/src/hooks/api/useBilling.ts`

- [ ] **Step 1: Create useBilling.ts**

Create `apps/dashboard/src/hooks/api/useBilling.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface BillingInvoice {
  id: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE';
  qrCode: string | null;
  qrCodeBase64: string | null;
}

export interface BillingStatus {
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  pricePerBooth: number;
  boothCount: number;
  billingAnchorDay: number;
  invoice: BillingInvoice | null;
}

export const useBilling = (options?: { poll?: boolean }) =>
  useQuery<BillingStatus>({
    queryKey: ['billing'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/billing');
      return data;
    },
    refetchInterval: options?.poll ? 5000 : false,
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1 | head -10
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/api/useBilling.ts
git commit -m "feat(dashboard): add useBilling hook with optional 5s polling"
```

---

## Task 11: Dashboard — BillingWall Component

**Files:**
- Create: `apps/dashboard/src/components/BillingWall.tsx`
- Create: `apps/dashboard/src/components/BillingWall.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/src/components/BillingWall.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingWall } from './BillingWall';

vi.mock('../hooks/api/useBilling', () => ({
  useBilling: vi.fn(),
}));

import { useBilling } from '../hooks/api/useBilling';

describe('BillingWall', () => {
  it('renders nothing when status is ACTIVE', () => {
    vi.mocked(useBilling).mockReturnValue({
      data: { status: 'ACTIVE', invoice: null, pricePerBooth: 200, boothCount: 2, billingAnchorDay: 15 },
      isLoading: false,
    } as any);
    const { container } = render(<BillingWall />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with QR code when status is SUSPENDED', () => {
    vi.mocked(useBilling).mockReturnValue({
      data: {
        status: 'SUSPENDED',
        pricePerBooth: 200,
        boothCount: 3,
        billingAnchorDay: 15,
        invoice: {
          id: 'inv-1',
          amount: 600,
          dueDate: '2026-05-22',
          status: 'OVERDUE',
          qrCode: 'qr-code-string',
          qrCodeBase64: 'base64string',
        },
      },
      isLoading: false,
    } as any);
    render(<BillingWall />);
    expect(screen.getByText(/assinatura suspensa/i)).toBeTruthy();
    expect(screen.getByText(/R\$\s*600/)).toBeTruthy();
  });

  it('renders nothing when data is loading', () => {
    vi.mocked(useBilling).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(<BillingWall />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/components/BillingWall.test.tsx
```

Expected: FAIL — Cannot find module './BillingWall'

- [ ] **Step 3: Implement BillingWall**

Create `apps/dashboard/src/components/BillingWall.tsx`:

```typescript
import React from 'react';
import { Lock } from 'lucide-react';
import { useBilling } from '../hooks/api/useBilling';

export const BillingWall: React.FC = () => {
  const { data: billing, isLoading } = useBilling({ poll: true });

  if (isLoading || !billing || billing.status !== 'SUSPENDED') return null;

  const { invoice, boothCount, pricePerBooth } = billing;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <Lock size={28} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Assinatura Suspensa</h1>
          <p className="text-white/60 text-sm">
            Escaneie o QR Code para regularizar e liberar o sistema imediatamente.
          </p>
        </div>

        {invoice?.qrCodeBase64 ? (
          <div className="bg-white p-4 rounded-2xl shadow-2xl inline-block mx-auto">
            <img
              src={`data:image/png;base64,${invoice.qrCodeBase64}`}
              alt="QR Code PIX Assinatura"
              className="w-48 h-48"
            />
          </div>
        ) : (
          <div className="w-56 h-56 bg-white/10 rounded-2xl flex items-center justify-center mx-auto">
            <p className="text-white/40 text-sm">QR Code em geração...</p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-white text-xl font-bold">
            R$ {invoice?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-white/40 text-xs">
            {boothCount} cabine(s) × R$ {pricePerBooth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {invoice?.dueDate && (
            <p className="text-white/40 text-xs">
              Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>

        <p className="text-white/30 text-xs flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          Aguardando confirmação do pagamento...
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/components/BillingWall.test.tsx
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/BillingWall.tsx apps/dashboard/src/components/BillingWall.test.tsx
git commit -m "feat(dashboard): add BillingWall overlay with 5s auto-unlock polling"
```

---

## Task 12: Dashboard — BillingPage

**Files:**
- Create: `apps/dashboard/src/pages/BillingPage.tsx`
- Create: `apps/dashboard/src/pages/BillingPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/dashboard/src/pages/BillingPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingPage } from './BillingPage';

vi.mock('../hooks/api/useBilling', () => ({
  useBilling: () => ({
    data: {
      status: 'ACTIVE',
      pricePerBooth: 200,
      boothCount: 3,
      billingAnchorDay: 15,
      invoice: null,
    },
    isLoading: false,
  }),
}));

describe('BillingPage', () => {
  it('renders billing page heading', () => {
    render(<BillingPage />);
    expect(screen.getByText('Assinatura')).toBeTruthy();
  });

  it('shows booth count and price per booth', () => {
    render(<BillingPage />);
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText(/200/)).toBeTruthy();
  });

  it('shows next billing day', () => {
    render(<BillingPage />);
    expect(screen.getByText(/15/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/pages/BillingPage.test.tsx
```

Expected: FAIL — Cannot find module

- [ ] **Step 3: Implement BillingPage**

Create `apps/dashboard/src/pages/BillingPage.tsx`:

```typescript
import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, Skeleton } from '../components/ui';
import { useBilling } from '../hooks/api/useBilling';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Ativa', icon: CheckCircle, color: 'text-green-600' },
  SUSPENDED: { label: 'Suspensa', icon: AlertCircle, color: 'text-red-600' },
  TRIAL: { label: 'Trial', icon: Clock, color: 'text-amber-600' },
};

export const BillingPage: React.FC = () => {
  const { data: billing, isLoading } = useBilling();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!billing) return null;

  const statusCfg = STATUS_CONFIG[billing.status];
  const StatusIcon = statusCfg.icon;
  const nextAmount = billing.boothCount * billing.pricePerBooth;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Assinatura</h1>

      {/* Status card */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Status</p>
          <span className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
            <StatusIcon size={15} />
            {statusCfg.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <p className="text-xs text-gray-400">Cabines ativas</p>
            <p className="text-2xl font-bold text-gray-900">{billing.boothCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Preço/cabine</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {billing.pricePerBooth.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Próximo vencimento</p>
            <p className="text-2xl font-bold text-gray-900">Dia {billing.billingAnchorDay}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Próxima cobrança prevista:{' '}
            <span className="font-medium text-gray-900">
              R$ {nextAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>
      </Card>

      {/* Pending invoice */}
      {billing.invoice && (
        <Card padding="md" className="space-y-3">
          <p className="font-semibold text-gray-900">Fatura pendente</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Valor</span>
            <span className="font-medium text-gray-900">
              R$ {billing.invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Vencimento</span>
            <span className="font-medium text-gray-900">
              {new Date(billing.invoice.dueDate).toLocaleDateString('pt-BR')}
            </span>
          </div>
          {billing.invoice.qrCodeBase64 && (
            <div className="flex justify-center pt-2">
              <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <img
                  src={`data:image/png;base64,${billing.invoice.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-40 h-40"
                />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/pages/BillingPage.test.tsx
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/BillingPage.tsx apps/dashboard/src/pages/BillingPage.test.tsx
git commit -m "feat(dashboard): add BillingPage with subscription status and invoice"
```

---

## Task 13: Dashboard Wiring — DashboardLayout + App.tsx

**Files:**
- Modify: `apps/dashboard/src/components/DashboardLayout.tsx`
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Add BillingWall to DashboardLayout**

Open `apps/dashboard/src/components/DashboardLayout.tsx`. Add the import:

```typescript
import { BillingWall } from './BillingWall';
```

Add `<BillingWall />` as the second child of the outermost div (after `<ImpersonationBanner />`):

```typescript
return (
  <div className="flex h-screen bg-gray-50">
    <ImpersonationBanner />
    <BillingWall />
    {/* ... rest of existing layout unchanged ... */}
```

- [ ] **Step 2: Add /billing route and nav item to App.tsx**

Open `apps/dashboard/src/App.tsx`. Add the lazy import:

```typescript
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));
```

Add the route inside the protected `<Routes>` block:

```typescript
<Route path="/billing" element={<BillingPage />} />
```

- [ ] **Step 3: Run all dashboard tests**

```bash
cd apps/dashboard && npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/DashboardLayout.tsx apps/dashboard/src/App.tsx
git commit -m "feat(dashboard): wire BillingWall into layout and add /billing route"
```

---

## Task 14: Totem — Lock Screen on Suspension

**Files:**
- Modify: `apps/totem/src/App.tsx`

- [ ] **Step 1: Add suspension check and lock screen to totem App.tsx**

Open `apps/totem/src/App.tsx`. The `config` from `useBoothConfig` now includes `suspended: boolean`.

After the existing imports, add a check in the main render. Find the section that renders screens based on state and add the suspended check before all states. After the `useBoothConfig` call:

```typescript
const { config } = useBoothConfig(BOOTH_ID, BOOTH_TOKEN, setDeviceConfig);
```

Add a `suspended` variable derived from config:

```typescript
const isSuspended = config?.suspended === true;
```

Before the screen routing logic (before any `if (state === ...)` or JSX switch), add a top-level suspension check. Find the main return statement and add this condition at the very beginning:

```typescript
// Show lock screen if subscription is suspended
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
```

Also handle the `402` case from the `useBoothMachine`. In `useBoothMachine.ts`, the `startPayment` function calls `POST /payments/pix`. If it returns 402, catch it and transition to a suspended state. Open `apps/totem/src/hooks/useBoothMachine.ts` and update the `startPayment` catch block:

```typescript
} catch (err: any) {
  // 402 = subscription suspended
  if (err?.response?.status === 402) {
    transition(BoothState.IDLE);
    // Force a config reload to pick up suspended: true
    window.location.reload();
    return;
  }
  const mode = config?.offlineMode ?? OfflineMode.BLOCK;
  // ... rest of existing catch logic unchanged
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/totem && npx tsc --noEmit 2>&1 | head -10
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/totem/src/App.tsx apps/totem/src/hooks/useBoothMachine.ts
git commit -m "feat(totem): show lock screen when subscription is suspended or 402 received"
```

---

## Post-Implementation: Dev Testing

To test billing flow in development:

**1. Manually trigger invoice generation (simulate cron):**
```bash
# From apps/api directory, trigger the job manually via Redis
node -e "
const Bull = require('bull');
const q = new Bull('subscription-billing', process.env.REDIS_URL || 'redis://localhost:6379');
q.add('generate-invoices', {}).then(() => { console.log('Job added'); q.close(); });
"
```

**2. Manually suspend a tenant (admin endpoint):**
```bash
curl -X POST http://localhost:3000/admin/tenants/<tenantId>/billing \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"subscriptionStatus": "SUSPENDED"}'
```

**3. Reactivate via webhook simulation:**
```bash
curl -X POST http://localhost:3000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "payment.updated", "data": {"id": "<subscriptionInvoice.externalId>"}}'
```
