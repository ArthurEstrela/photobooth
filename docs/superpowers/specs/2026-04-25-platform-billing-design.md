# Platform Billing Implementation Design

**Goal:** Automatically charge tenants R$200/booth/month (configurable per-tenant) via Mercado Pago PIX, block non-paying tenants on both totem and dashboard, and unblock automatically when payment is confirmed.

**Architecture:** Two new Prisma enums (`SubStatus`, `InvoiceStatus`) and a `SubscriptionInvoice` table. Two daily BullMQ cron jobs: one generates invoices on each tenant's anniversary date, one suspends overdue tenants. Payment is collected via Arthur's MP account (`MP_ACCESS_TOKEN`). Blocking is enforced at the API level on critical payment endpoints (402) and at the totem boot check. Dashboard shows a `BillingWall` overlay with PIX QR code that auto-disappears via polling when payment is confirmed.

**Tech Stack:** NestJS, Prisma/PostgreSQL, BullMQ (already in project), Mercado Pago PIX API, React + TanStack Query (refetchInterval polling).

---

## Scope

This spec covers:
- `SubStatus` and `InvoiceStatus` Prisma enums + `SubscriptionInvoice` model
- `subscriptionStatus`, `pricePerBooth`, `billingAnchorDay` fields on `Tenant`
- BullMQ daily job: generate invoices for tenants whose anniversary is today
- BullMQ daily job: suspend tenants with overdue invoices
- Webhook processing for subscription payments (reactivation)
- Hard 402 block on `POST /payments/pix` and digital payments when tenant is SUSPENDED
- `GET /booths/:id/config` includes `suspended: boolean`
- `GET /tenant/billing` — current billing status + invoice QR code
- `POST /admin/tenants/:id/billing` — Arthur sets `pricePerBooth`, forces status
- Dashboard `BillingWall` component with 5s polling auto-unlock
- Dashboard `BillingPage` with invoice history
- Totem lock screen on `suspended: true` or `402` response
- Admin tenant table additions (subscription status badge, price per booth)

This spec does NOT cover:
- Credit card or boleto billing (PIX only)
- Multi-seat pricing (price is per booth, not per user)
- Proration for mid-cycle booth additions/removals
- Email notifications (out of scope for now)

---

## Environment Variables

No new variables required. Uses the existing `MP_ACCESS_TOKEN` (Arthur's account) to create subscription PIX payments.

---

## Data Model

### New Prisma Enums

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

### Tenant model additions

Add to the `Tenant` model in `apps/api/prisma/schema.prisma`:

```prisma
subscriptionStatus  SubStatus @default(ACTIVE)
pricePerBooth       Decimal   @default(200)
billingAnchorDay    Int       @default(1)
subscriptionInvoices SubscriptionInvoice[]
```

`billingAnchorDay` is set at registration time: `Math.min(signupDate.getDate(), 28)`. This handles months with fewer than 29 days (anchor days 29–31 are capped at 28).

### New SubscriptionInvoice model

```prisma
model SubscriptionInvoice {
  id            String      @id @default(uuid())
  tenantId      String
  tenant        Tenant      @relation(fields: [tenantId], references: [id])
  boothCount    Int
  pricePerBooth Decimal
  amount        Decimal     // boothCount × pricePerBooth
  dueDate       DateTime    // invoice createdAt + 7 days
  status        InvoiceStatus @default(PENDING)
  externalId    String?     @unique  // MP payment ID
  qrCode        String?
  qrCodeBase64  String?
  paidAt        DateTime?
  createdAt     DateTime    @default(now())
}
```

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add enums, Tenant fields, SubscriptionInvoice model |
| `apps/api/src/use-cases/generate-invoices.use-case.ts` | Create | Business logic: count booths, create MP PIX, save invoice |
| `apps/api/src/use-cases/check-overdue-invoices.use-case.ts` | Create | Mark overdue invoices, suspend tenants |
| `apps/api/src/workers/subscription-billing.processor.ts` | Create | BullMQ processor for `generate-invoices` and `check-overdue` jobs |
| `apps/api/src/use-cases/process-webhook.use-case.ts` | Modify | Handle subscription payment type → mark PAID, reactivate tenant |
| `apps/api/src/use-cases/create-pix-payment.use-case.ts` | Modify | Add 402 check for SUSPENDED tenants |
| `apps/api/src/use-cases/create-digital-payment.use-case.ts` | Modify | Add 402 check for SUSPENDED tenants |
| `apps/api/src/controllers/booths.controller.ts` | Modify | Add `suspended` field to `/booths/:id/config` response |
| `apps/api/src/controllers/tenant.controller.ts` | Modify | Add `GET /tenant/billing` endpoint |
| `apps/api/src/controllers/admin.controller.ts` | Modify | Add `POST /admin/tenants/:id/billing` endpoint |
| `apps/api/src/auth/auth.service.ts` | Modify | Set `billingAnchorDay` on `register()` |
| `apps/api/src/app.module.ts` | Modify | Register `subscription-billing` queue and processor |
| `apps/dashboard/src/hooks/api/useBilling.ts` | Create | `useBilling()` with `refetchInterval: 5000` |
| `apps/dashboard/src/components/BillingWall.tsx` | Create | Fullscreen overlay with PIX QR, auto-unlocks via polling |
| `apps/dashboard/src/pages/BillingPage.tsx` | Create | Invoice history, next billing date, current amount |
| `apps/dashboard/src/components/DashboardLayout.tsx` | Modify | Render `<BillingWall />` when `status === SUSPENDED` |
| `apps/dashboard/src/App.tsx` | Modify | Add `/billing` route (lazy-loaded, inside ProtectedRoute) |
| `apps/totem/src/screens/IdleScreen.tsx` | Modify | Accept `suspended?: boolean` prop, show lock screen |

---

## Detailed Design

### 1. Registration: Set billingAnchorDay

In `apps/api/src/auth/auth.service.ts`, `register()` method, add `billingAnchorDay` when creating the tenant:

```typescript
const anchorDay = Math.min(new Date().getDate(), 28);
const tenant = await this.prisma.tenant.create({
  data: { name: dto.name, email: dto.email, passwordHash, billingAnchorDay: anchorDay },
});
```

---

### 2. GenerateInvoicesUseCase

`apps/api/src/use-cases/generate-invoices.use-case.ts`

```typescript
@Injectable()
export class GenerateInvoicesUseCase {
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
      if (boothCount === 0) continue; // no booths, no charge

      const amount = Number(tenant.pricePerBooth) * boothCount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      // Create invoice record first to get the ID for MP metadata
      const invoice = await this.prisma.subscriptionInvoice.create({
        data: {
          tenantId: tenant.id,
          boothCount,
          pricePerBooth: tenant.pricePerBooth,
          amount,
          dueDate,
        },
      });

      // Create PIX using Arthur's global MP token
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
    }
  }
}
```

---

### 3. CheckOverdueInvoicesUseCase

`apps/api/src/use-cases/check-overdue-invoices.use-case.ts`

```typescript
@Injectable()
export class CheckOverdueInvoicesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<void> {
    const now = new Date();

    const overdueInvoices = await this.prisma.subscriptionInvoice.findMany({
      where: { status: 'PENDING', dueDate: { lt: now } },
      select: { id: true, tenantId: true },
    });

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
  }
}
```

---

### 4. SubscriptionBillingProcessor (BullMQ)

`apps/api/src/workers/subscription-billing.processor.ts`

```typescript
import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { OnModuleInit, Injectable } from '@nestjs/common';
import { GenerateInvoicesUseCase } from '../use-cases/generate-invoices.use-case';
import { CheckOverdueInvoicesUseCase } from '../use-cases/check-overdue-invoices.use-case';

@Processor('subscription-billing')
@Injectable()
export class SubscriptionBillingProcessor implements OnModuleInit {
  constructor(
    @InjectQueue('subscription-billing') private readonly queue: Queue,
    private readonly generateInvoices: GenerateInvoicesUseCase,
    private readonly checkOverdue: CheckOverdueInvoicesUseCase,
  ) {}

  async onModuleInit() {
    // Register recurring jobs if not already present
    const jobs = await this.queue.getRepeatableJobs();
    if (!jobs.find((j) => j.name === 'generate-invoices')) {
      await this.queue.add('generate-invoices', {}, { repeat: { cron: '0 0 * * *' } });
    }
    if (!jobs.find((j) => j.name === 'check-overdue')) {
      await this.queue.add('check-overdue', {}, { repeat: { cron: '0 9 * * *' } });
    }
  }

  @Process('generate-invoices')
  async handleGenerateInvoices(_job: Job) {
    await this.generateInvoices.execute();
  }

  @Process('check-overdue')
  async handleCheckOverdue(_job: Job) {
    await this.checkOverdue.execute();
  }
}
```

---

### 5. Webhook: Subscription Payment

In `apps/api/src/use-cases/process-webhook.use-case.ts`, at the **top** of `execute()`, before the existing `Payment` table lookup, add a check for `SubscriptionInvoice`:

```typescript
async execute(payload: any) {
  const { action, data } = payload;
  if (action !== 'payment.updated') return;

  const externalId = data.id.toString();

  // Check SubscriptionInvoice first — subscription PIX are not in the Payment table
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
    this.logger.log(`Subscription invoice ${invoice.id} paid, tenant reactivated`);
    return;
  }

  // Fall through to existing Payment table lookup (photobooth session payments)
  const payment = await this.prisma.payment.findFirst({
    where: {
      OR: [
        { externalId },
        ...(process.env.NODE_ENV !== 'production' ? [{ id: externalId }] : []),
      ],
    },
    include: { booth: true },
  });
  // ... rest of existing logic unchanged
}
```

---

### 6. Hard 402 Block on Payment Use-Cases

Add to both `create-pix-payment.use-case.ts` and `create-digital-payment.use-case.ts`, after looking up the booth's tenant:

```typescript
const tenant = await this.prisma.tenant.findUnique({
  where: { id: booth.tenantId },
  select: { subscriptionStatus: true, mpAccessToken: true, mpRefreshToken: true, mpTokenExpiresAt: true },
});

if (tenant?.subscriptionStatus === 'SUSPENDED') {
  throw new HttpException('Assinatura suspensa', HttpStatus.PAYMENT_REQUIRED);
}
```

---

### 7. Booths Config: suspended field

In `apps/api/src/controllers/booths.controller.ts`, `GET /booths/:id/config` response, add:

```typescript
const tenant = await this.prisma.tenant.findUnique({
  where: { id: booth.tenantId },
  select: { subscriptionStatus: true, /* existing fields */ },
});

return {
  // ...existing config fields...
  suspended: tenant?.subscriptionStatus === 'SUSPENDED',
};
```

---

### 8. GET /tenant/billing

Add to `apps/api/src/controllers/tenant.controller.ts`:

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

  const pendingInvoice = await this.prisma.subscriptionInvoice.findFirst({
    where: { tenantId: req.user.tenantId, status: { in: ['PENDING', 'OVERDUE'] } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    status: tenant!.subscriptionStatus,
    pricePerBooth: Number(tenant!.pricePerBooth),
    boothCount: tenant!._count.booths,
    billingAnchorDay: tenant!.billingAnchorDay,
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

---

### 9. POST /admin/tenants/:id/billing

Add to `apps/api/src/controllers/admin.controller.ts`:

```typescript
@Post('tenants/:tenantId/billing')
async updateTenantBilling(
  @Param('tenantId') tenantId: string,
  @Body() body: { pricePerBooth?: number; subscriptionStatus?: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' },
) {
  const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundException('Tenant not found');

  return this.prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(body.pricePerBooth !== undefined && { pricePerBooth: body.pricePerBooth }),
      ...(body.subscriptionStatus !== undefined && { subscriptionStatus: body.subscriptionStatus }),
    },
    select: { id: true, subscriptionStatus: true, pricePerBooth: true },
  });
}
```

---

### 10. useBilling hook

`apps/dashboard/src/hooks/api/useBilling.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export interface BillingStatus {
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  pricePerBooth: number;
  boothCount: number;
  billingAnchorDay: number;
  invoice: {
    id: string;
    amount: number;
    dueDate: string;
    status: 'PENDING' | 'OVERDUE';
    qrCode: string | null;
    qrCodeBase64: string | null;
  } | null;
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

---

### 11. BillingWall Component

`apps/dashboard/src/components/BillingWall.tsx`

Fullscreen overlay rendered when `billing.status === 'SUSPENDED'`. Uses `useBilling({ poll: true })` — auto-disappears when `status` changes to `ACTIVE`.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🔒  Assinatura Suspensa                            │
│                                                     │
│  Escaneie o QR Code abaixo para regularizar         │
│  e liberar o sistema imediatamente.                 │
│                                                     │
│  [QR Code PIX]                                      │
│                                                     │
│  Valor: R$ 600,00 (3 cabines × R$ 200,00)           │
│  Vencimento: 15/05/2026                             │
│                                                     │
│  Aguardando confirmação do pagamento...  ⟳           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Rendered inside `DashboardLayout` as the first child, before any page content. When `status === 'ACTIVE'`, returns `null`.

---

### 12. BillingPage

`apps/dashboard/src/pages/BillingPage.tsx`

Route `/billing` — add as a lazy-loaded route inside `AppContent`'s protected `<Routes>` block in `App.tsx`:
```typescript
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));
// inside protected Routes:
<Route path="/billing" element={<BillingPage />} />
```

Always accessible (even during SUSPENDED — tenant needs to see their invoice history). Shows:
- Current subscription status badge
- Next billing date and projected amount (boothCount × pricePerBooth)
- Table of invoice history: date, amount, status (PAID/PENDING/OVERDUE), link to pay if PENDING

---

### 13. Totem lock screen

In `apps/totem/src/App.tsx` (or `useBoothMachine.ts`), when `GET /booths/:id/config` returns `suspended: true` or any API call returns `status 402`, show a fullscreen lock screen instead of the normal flow:

```
Tela preta, texto branco:
"Sistema temporariamente suspenso.
 Entre em contato com o operador."
```

---

### 14. Admin tenant table additions

`apps/dashboard/src/pages/AdminTenantsPage.tsx` — add two columns:

| ... | Assinatura | Preço/cab |
|---|---|---|
| ... | 🟢 ACTIVE | R$200 |
| ... | 🔴 SUSPENDED | R$150 |

Clicking the price opens an inline edit field that calls `POST /admin/tenants/:id/billing`.

---

## Auth Flow: Billing Registration

When tenant registers via `POST /auth/register`:
1. `billingAnchorDay = Math.min(new Date().getDate(), 28)`
2. `subscriptionStatus = ACTIVE` (default)
3. First invoice generated 1 month later when the daily job runs on the tenant's anchor day

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Totem boot with `suspended: true` | Lock screen shown, no session possible |
| `POST /payments/pix` while SUSPENDED | API returns `402 Payment Required`, totem shows lock screen |
| Invoice already generated this period | `GenerateInvoicesUseCase` skips (idempotency check) |
| Tenant has 0 booths on billing day | Invoice not generated, no charge |
| MP PIX creation fails during invoice generation | Invoice record remains without `externalId`/QR code; logged as error; job retried by BullMQ |
| Webhook received for already-PAID invoice | `process-webhook` returns early (idempotent) |

---

## Testing

**API:**
- `GenerateInvoicesUseCase`: skips existing invoice for current period; generates correct amount; skips tenants with 0 booths
- `CheckOverdueInvoicesUseCase`: suspends tenant with overdue PENDING invoice; ignores PAID invoices
- `ProcessWebhookUseCase`: subscription payment reactivates tenant + marks invoice PAID + sets paidAt
- `CreatePixPaymentUseCase`: throws 402 when tenant is SUSPENDED
- `GET /tenant/billing`: returns pending invoice with QR code when SUSPENDED
- `POST /admin/tenants/:id/billing`: updates pricePerBooth and status

**Dashboard:**
- `BillingWall`: shown when status is SUSPENDED, hidden when ACTIVE, contains QR code
- `useBilling`: polls every 5s when `poll: true`, does not poll otherwise
