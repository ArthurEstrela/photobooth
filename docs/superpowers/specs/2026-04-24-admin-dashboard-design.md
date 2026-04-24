# Admin Dashboard Implementation Design

**Goal:** Arthur can log in as a platform admin to see all tenants, their MP connection status and booth count, and impersonate any tenant to use their dashboard directly for support.

**Architecture:** Three new API endpoints (admin login, tenant list, impersonate) protected by a new `AdminGuard`. Admin credentials live in env vars (no DB changes). Impersonation issues a standard tenant JWT — zero changes to existing tenant guards. The dashboard gains two admin-only routes (`/admin/login`, `/admin`) and an `AdminAuthContext` that stores the admin token separately from the tenant token. An `ImpersonationBanner` shows during impersonation and allows Arthur to exit back to the admin view.

**Tech Stack:** NestJS, `@nestjs/jwt`, bcrypt, React + React Router, TanStack Query, Tailwind CSS 3.

---

## Scope

This spec covers:
- Admin authentication via env-var credentials
- `GET /admin/tenants` — list all tenants with MP status and booth count
- `POST /admin/impersonate/:tenantId` — return a tenant-scoped JWT
- `AdminGuard` — verifies `role: 'admin'` in JWT, rejects all other tokens
- Dashboard admin routes: `/admin/login`, `/admin`
- `AdminAuthContext` — stores admin token separately
- `ImpersonationBanner` — fixed banner during impersonation with exit button

This spec does NOT cover:
- Editing tenant settings as admin (read + impersonate only)
- Platform billing / subscription management (separate spec)
- Audit logs of admin actions

---

## Environment Variables

New variables required:

| Variable | Description |
|---|---|
| `ADMIN_EMAIL` | Arthur's admin email address |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (10 rounds) |

Generate hash: `node -e "require('bcrypt').hash('yourpassword', 10).then(console.log)"`

---

## Data Model

No Prisma schema changes required. All tenant data is already in the DB.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/auth/admin.guard.ts` | Create | Verifies JWT has `role: 'admin'`; rejects tenant tokens |
| `apps/api/src/auth/auth.controller.ts` | Modify | Add `POST /auth/admin/login` endpoint |
| `apps/api/src/auth/auth.service.ts` | Modify | Add `adminLogin(email, password)` method |
| `apps/api/src/controllers/admin.controller.ts` | Create | `GET /admin/tenants`, `POST /admin/impersonate/:tenantId` |
| `apps/api/src/app.module.ts` | Modify | Register `AdminController` |
| `apps/dashboard/src/context/AdminAuthContext.tsx` | Create | Admin token storage, `adminLogin()`, `adminLogout()`, `isImpersonating` flag |
| `apps/dashboard/src/pages/AdminLoginPage.tsx` | Create | Admin login form |
| `apps/dashboard/src/pages/AdminTenantsPage.tsx` | Create | Tenant list table with "Entrar como" button |
| `apps/dashboard/src/components/ImpersonationBanner.tsx` | Create | Fixed top banner during impersonation |
| `apps/dashboard/src/hooks/api/useAdmin.ts` | Create | `useAdminTenants()`, `useImpersonate()` hooks |
| `apps/dashboard/src/context/AuthContext.tsx` | Modify | Expose `setToken(token: string \| null)` method |
| `apps/dashboard/src/App.tsx` (or router file) | Modify | Add `/admin/login` and `/admin` routes, wrap with `AdminAuthContext` |
| `apps/dashboard/src/components/DashboardLayout.tsx` | Modify | Render `ImpersonationBanner` when impersonating |

---

## Detailed Design

### 1. AdminGuard

`apps/api/src/auth/admin.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(auth.slice(7)) as any;
      if (payload.role !== 'admin') throw new UnauthorizedException();
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

---

### 2. AuthService — adminLogin

Add to `apps/api/src/auth/auth.service.ts`:

```typescript
async adminLogin(email: string, password: string): Promise<{ token: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminHash) {
    throw new UnauthorizedException('Admin not configured');
  }

  const emailMatch = email === adminEmail;
  const passwordMatch = await bcrypt.compare(password, adminHash);

  if (!emailMatch || !passwordMatch) {
    throw new UnauthorizedException('Invalid admin credentials');
  }

  const token = this.jwt.sign(
    { sub: 'admin', email: adminEmail, role: 'admin' },
    { expiresIn: '24h' },
  );
  return { token };
}
```

---

### 3. AuthController — POST /auth/admin/login

Add to `apps/api/src/auth/auth.controller.ts`:

```typescript
@Post('admin/login')
async adminLogin(@Body() body: { email: string; password: string }) {
  return this.authService.adminLogin(body.email, body.password);
}
```

---

### 4. AdminController

`apps/api/src/controllers/admin.controller.ts`

```typescript
import { Controller, Get, Post, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Get('tenants')
  async getTenants() {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        mpAccessToken: true,
        _count: { select: { booths: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      createdAt: t.createdAt,
      mpConnected: !!t.mpAccessToken,
      boothCount: t._count.booths,
    }));
  }

  @Post('impersonate/:tenantId')
  async impersonate(@Param('tenantId') tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, email: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const token = this.jwt.sign(
      { sub: tenant.id, email: tenant.email },
      { expiresIn: '7d' },
    );
    return { token, tenantId: tenant.id, email: tenant.email };
  }
}
```

---

### 5. AdminAuthContext

`apps/dashboard/src/context/AdminAuthContext.tsx`

Stores admin token in `localStorage` under key `admin_token`. Exposes:

```typescript
interface AdminAuthContextValue {
  adminToken: string | null;
  adminEmail: string | null;
  isImpersonating: boolean;
  impersonatedEmail: string | null;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => void;
  startImpersonation: (tenantToken: string, tenantEmail: string) => void;
  stopImpersonation: () => void;
}
```

`startImpersonation` calls `AuthContext.setToken(tenantToken)` (a new method to be added to the existing `AuthContext`), and stores `impersonatedEmail` in `AdminAuthContext` state.

`stopImpersonation` calls `AuthContext.setToken(null)` to clear the tenant session, then restores admin-only view.

---

### 6. useAdmin hooks

`apps/dashboard/src/hooks/api/useAdmin.ts`

```typescript
// Uses adminToken (from AdminAuthContext) in Authorization header

export const useAdminTenants = () =>
  useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const { data } = await adminApi.get('/admin/tenants');
      return data as AdminTenant[];
    },
  });

export const useImpersonate = () =>
  useMutation({
    mutationFn: async (tenantId: string) => {
      const { data } = await adminApi.post(`/admin/impersonate/${tenantId}`);
      return data as { token: string; tenantId: string; email: string };
    },
  });
```

`adminApi` is an axios instance created in `useAdmin.ts` that reads `admin_token` from localStorage and sets `Authorization: Bearer <token>` on every request. It is NOT the same instance as the regular `api` used by tenant hooks.

---

### 7. AdminLoginPage

`apps/dashboard/src/pages/AdminLoginPage.tsx`

Simple form: email + password fields, submit calls `adminLogin()` from `AdminAuthContext`, redirects to `/admin` on success. Shows error message on 401.

---

### 8. AdminTenantsPage

`apps/dashboard/src/pages/AdminTenantsPage.tsx`

Table with columns: Nome, Email, Cadastro, MP, Cabines, Ação.

MP column shows `✓` (green) or `✗` (gray). Ação column has "Entrar como" button that:
1. Calls `useImpersonate(tenantId)`
2. On success: calls `startImpersonation(token, email)` from `AdminAuthContext`
3. Redirects to `/`

---

### 9. ImpersonationBanner

`apps/dashboard/src/components/ImpersonationBanner.tsx`

Fixed yellow/amber bar at the very top of the screen (above the normal header), shown only when `isImpersonating` is true:

```
⚠ Visualizando como: email@tenant.com    [Sair da impersonação]
```

Clicking "Sair" calls `stopImpersonation()` and redirects to `/admin`.

---

### 10. Router changes

Add to the main router:
- `/admin/login` → `AdminLoginPage` (public, no auth required)
- `/admin` → `AdminTenantsPage` (requires admin auth — redirect to `/admin/login` if no `admin_token`)

`AdminAuthContext` wraps the full app so both admin and tenant pages can check `isImpersonating`.

---

## Auth Flow Summary

```
Arthur opens /admin/login
→ POST /auth/admin/login { email, password }
← { token: "admin-jwt..." }
→ stored in localStorage as admin_token
→ redirected to /admin

Arthur clicks "Entrar como" on tenant row
→ POST /admin/impersonate/:tenantId (with admin JWT)
← { token: "tenant-jwt...", email: "tenant@email.com" }
→ tenant JWT saved to AuthContext (replaces any current token)
→ isImpersonating = true, impersonatedEmail = "tenant@email.com"
→ redirected to /

Arthur sees ImpersonationBanner: "Visualizando como: tenant@email.com [Sair]"
Arthur clicks Sair
→ AuthContext token cleared
→ isImpersonating = false
→ redirected to /admin
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Wrong admin credentials | 401, "Credenciais inválidas" on login form |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` not set | 401, admin login always fails |
| Admin JWT expired (24h) | 401 on any `/admin/*` call → redirect to `/admin/login` |
| Impersonating non-existent tenant | 404 from API, error toast on dashboard |
| Tenant JWT expired during impersonation | Normal tenant 401 flow — AuthContext clears token, redirects to `/login` |

---

## Testing

**API:**
- `AdminGuard`: rejects missing token, rejects tenant token (no `role: 'admin'`), accepts admin token
- `AuthService.adminLogin`: wrong email → 401, wrong password → 401, correct → returns token with `role: 'admin'`
- `AdminController.getTenants`: returns mapped list with `mpConnected` boolean and `boothCount`
- `AdminController.impersonate`: unknown tenantId → 404; valid → returns tenant JWT without `role` field

**Dashboard:**
- `AdminLoginPage`: form submits, shows error on 401, redirects on success
- `AdminTenantsPage`: renders tenant rows, "Entrar como" calls impersonate mutation
- `ImpersonationBanner`: shown when `isImpersonating`, hidden otherwise, Sair calls `stopImpersonation`
