# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin dashboard where Arthur can log in, see all tenants with their MP and booth status, and impersonate any tenant to use their dashboard for support.

**Architecture:** Three new API endpoints behind a new `AdminGuard` (credentials from env vars, no DB changes). Impersonation issues a tenant JWT with `impersonated: true` in the payload — existing tenant guards are untouched. The dashboard gains `/admin/login` and `/admin` routes via `AdminAuthContext`; `isImpersonating` is derived from the token payload (not React state) so it survives hard reloads. An amber `ImpersonationBanner` shows globally when impersonating.

**Tech Stack:** NestJS, `@nestjs/jwt`, bcrypt, React, React Router, TanStack Query, Tailwind CSS 3, Vitest + @testing-library/react.

---

## File Map

| File | Action |
|---|---|
| `apps/api/src/auth/admin.guard.ts` | Create |
| `apps/api/src/auth/admin.guard.spec.ts` | Create |
| `apps/api/src/auth/auth.service.ts` | Modify — add `adminLogin` |
| `apps/api/src/auth/auth.service.spec.ts` | Modify — add `adminLogin` tests |
| `apps/api/src/auth/auth.controller.ts` | Modify — add `POST /auth/admin/login` |
| `apps/api/src/auth/auth.controller.spec.ts` | Create |
| `apps/api/src/controllers/admin.controller.ts` | Create |
| `apps/api/src/controllers/admin.controller.spec.ts` | Create |
| `apps/api/src/app.module.ts` | Modify — register `AdminController` |
| `apps/dashboard/src/context/AdminAuthContext.tsx` | Create |
| `apps/dashboard/src/hooks/api/useAdmin.ts` | Create |
| `apps/dashboard/src/pages/AdminLoginPage.tsx` | Create |
| `apps/dashboard/src/pages/AdminLoginPage.test.tsx` | Create |
| `apps/dashboard/src/pages/AdminTenantsPage.tsx` | Create |
| `apps/dashboard/src/pages/AdminTenantsPage.test.tsx` | Create |
| `apps/dashboard/src/components/ImpersonationBanner.tsx` | Create |
| `apps/dashboard/src/components/ImpersonationBanner.test.tsx` | Create |
| `apps/dashboard/src/App.tsx` | Modify — add `/admin/*` routes |
| `apps/dashboard/src/components/DashboardLayout.tsx` | Modify — render `ImpersonationBanner` |

---

## Task 1: AdminGuard

**Files:**
- Create: `apps/api/src/auth/admin.guard.ts`
- Create: `apps/api/src/auth/admin.guard.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/auth/admin.guard.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { JwtService } from '@nestjs/jwt';

const mockJwt = { verify: jest.fn() };

const makeContext = (token?: string) => ({
  switchToHttp: () => ({
    getRequest: () => ({
      headers: { authorization: token ? `Bearer ${token}` : undefined },
    }),
  }),
});

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard(mockJwt as unknown as JwtService);
    jest.clearAllMocks();
  });

  it('rejects request with no Authorization header', () => {
    expect(() => guard.canActivate(makeContext() as any)).toThrow(UnauthorizedException);
  });

  it('rejects a token without role: admin', () => {
    mockJwt.verify.mockReturnValue({ sub: 'tenant-1', email: 't@t.com' });
    expect(() => guard.canActivate(makeContext('tenant-token') as any)).toThrow(UnauthorizedException);
  });

  it('rejects an impersonated token (impersonated: true)', () => {
    mockJwt.verify.mockReturnValue({ sub: 'admin', role: 'admin', impersonated: true });
    expect(() => guard.canActivate(makeContext('imp-token') as any)).toThrow(UnauthorizedException);
  });

  it('accepts a valid admin token and sets request.user', () => {
    const payload = { sub: 'admin', email: 'a@a.com', role: 'admin' };
    mockJwt.verify.mockReturnValue(payload);
    const req: any = { headers: { authorization: 'Bearer valid-admin-token' } };
    const ctx: any = { switchToHttp: () => ({ getRequest: () => req }) };
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual(payload);
  });

  it('rejects a token that fails jwt.verify (expired/tampered)', () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    expect(() => guard.canActivate(makeContext('bad-token') as any)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=admin.guard --no-coverage
```

Expected: FAIL with "Cannot find module './admin.guard'"

- [ ] **Step 3: Implement AdminGuard**

Create `apps/api/src/auth/admin.guard.ts`:

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
      if (payload.role !== 'admin' || payload.impersonated) throw new UnauthorizedException();
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=admin.guard --no-coverage
```

Expected: PASS, 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/admin.guard.ts apps/api/src/auth/admin.guard.spec.ts
git commit -m "feat(api): add AdminGuard for role-based admin endpoint protection"
```

---

## Task 2: AuthService.adminLogin

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Add failing tests to the existing spec file**

Open `apps/api/src/auth/auth.service.spec.ts`. At the end of the `describe('AuthService', () => {` block (before the final `}`), add:

```typescript
describe('adminLogin', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'admin@photobooth.com';
    process.env.ADMIN_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuuVGmRpEzJZ0yTmGQmwIOHBxJd8SIHK5K'; // bcrypt of 'secret123'
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD_HASH;
  });

  it('throws UnauthorizedException when ADMIN_EMAIL is not set', async () => {
    delete process.env.ADMIN_EMAIL;
    await expect(service.adminLogin('admin@photobooth.com', 'secret123')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for wrong email', async () => {
    await expect(service.adminLogin('wrong@email.com', 'secret123')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for wrong password', async () => {
    await expect(service.adminLogin('admin@photobooth.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
  });

  it('returns token with role: admin on correct credentials', async () => {
    mockJwt.sign.mockReturnValue('admin.jwt.token');
    const result = await service.adminLogin('admin@photobooth.com', 'secret123');
    expect(result).toEqual({ token: 'admin.jwt.token' });
    expect(mockJwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      expect.objectContaining({ expiresIn: '24h' }),
    );
  });
});
```

Note: The hash `$2b$10$abcdefghijklmnopqrstuuVGmRpEzJZ0yTmGQmwIOHBxJd8SIHK5K` is a real bcrypt hash of `'secret123'`. To generate your own: `node -e "require('bcrypt').hash('secret123', 10).then(console.log)"`.

- [ ] **Step 2: Run tests to verify new ones fail**

```bash
cd apps/api && npx jest --testPathPattern=auth.service --no-coverage
```

Expected: 4 new tests FAIL with "service.adminLogin is not a function"

- [ ] **Step 3: Add adminLogin to AuthService**

Open `apps/api/src/auth/auth.service.ts`. Add this method before the private `buildToken` method:

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
    throw new UnauthorizedException('Credenciais inválidas');
  }

  const token = this.jwt.sign(
    { sub: 'admin', email: adminEmail, role: 'admin' },
    { expiresIn: '24h' },
  );
  return { token };
}
```

- [ ] **Step 4: Run all auth service tests**

```bash
cd apps/api && npx jest --testPathPattern=auth.service --no-coverage
```

Expected: PASS, all tests passing (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): add AuthService.adminLogin with env-var credentials"
```

---

## Task 3: AuthController — POST /auth/admin/login

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/auth/auth.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  changePassword: jest.fn(),
  adminLogin: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('POST /auth/admin/login delegates to authService.adminLogin', async () => {
    mockAuthService.adminLogin.mockResolvedValue({ token: 'admin-jwt' });
    const result = await controller.adminLogin({ email: 'a@a.com', password: 'pw' });
    expect(mockAuthService.adminLogin).toHaveBeenCalledWith('a@a.com', 'pw');
    expect(result).toEqual({ token: 'admin-jwt' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=auth.controller --no-coverage
```

Expected: FAIL — `controller.adminLogin is not a function`

- [ ] **Step 3: Add endpoint to AuthController**

Open `apps/api/src/auth/auth.controller.ts`. Add this method at the end of the class (before the closing `}`):

```typescript
@Post('admin/login')
@HttpCode(HttpStatus.OK)
adminLogin(@Body() body: { email: string; password: string }) {
  return this.authService.adminLogin(body.email, body.password);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=auth.controller --no-coverage
```

Expected: PASS, 1 test passing

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.controller.ts apps/api/src/auth/auth.controller.spec.ts
git commit -m "feat(api): add POST /auth/admin/login endpoint"
```

---

## Task 4: AdminController + AppModule Registration

**Files:**
- Create: `apps/api/src/controllers/admin.controller.ts`
- Create: `apps/api/src/controllers/admin.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/controllers/admin.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from '../auth/admin.guard';

const mockPrisma = {
  tenant: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn() };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  describe('GET /admin/tenants', () => {
    it('returns mapped tenant list with mpConnected and boothCount', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        {
          id: 't1',
          name: 'Foto Express',
          email: 'foto@express.com',
          createdAt: new Date('2026-01-01'),
          mpAccessToken: 'enc:sometoken',
          _count: { booths: 3 },
        },
        {
          id: 't2',
          name: 'Studio XYZ',
          email: 'studio@xyz.com',
          createdAt: new Date('2026-02-01'),
          mpAccessToken: null,
          _count: { booths: 1 },
        },
      ]);

      const result = await controller.getTenants();

      expect(result).toEqual([
        { id: 't1', name: 'Foto Express', email: 'foto@express.com', createdAt: new Date('2026-01-01'), mpConnected: true, boothCount: 3 },
        { id: 't2', name: 'Studio XYZ', email: 'studio@xyz.com', createdAt: new Date('2026-02-01'), mpConnected: false, boothCount: 1 },
      ]);
    });
  });

  describe('POST /admin/impersonate/:tenantId', () => {
    it('throws NotFoundException for unknown tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(controller.impersonate('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns tenant JWT with impersonated: true in payload', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1', email: 'foto@express.com' });
      mockJwt.sign.mockReturnValue('tenant-impersonation-jwt');

      const result = await controller.impersonate('t1');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        { sub: 't1', email: 'foto@express.com', impersonated: true },
        { expiresIn: '7d' },
      );
      expect(result).toEqual({ token: 'tenant-impersonation-jwt', tenantId: 't1', email: 'foto@express.com' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest --testPathPattern=admin.controller --no-coverage
```

Expected: FAIL with "Cannot find module './admin.controller'"

- [ ] **Step 3: Implement AdminController**

Create `apps/api/src/controllers/admin.controller.ts`:

```typescript
import { Controller, Get, Post, Param, UseGuards, NotFoundException } from '@nestjs/common';
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
      { sub: tenant.id, email: tenant.email, impersonated: true },
      { expiresIn: '7d' },
    );
    return { token, tenantId: tenant.id, email: tenant.email };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && npx jest --testPathPattern=admin.controller --no-coverage
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Register AdminController in AppModule**

Open `apps/api/src/app.module.ts`. Add the import at the top:

```typescript
import { AdminController } from './controllers/admin.controller';
```

Add `AdminController` to the `controllers` array (after `AuthController`):

```typescript
controllers: [
  AuthController,
  MpOAuthController,
  AdminController,   // ← add this
  TenantController,
  // ... rest unchanged
],
```

- [ ] **Step 6: Run all API tests**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: All tests pass (existing + new, ignore pre-existing booth.gateway failures)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts apps/api/src/controllers/admin.controller.spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): add AdminController with tenant list and impersonation endpoints"
```

---

## Task 5: AdminAuthContext

**Files:**
- Create: `apps/dashboard/src/context/AdminAuthContext.tsx`

- [ ] **Step 1: Create AdminAuthContext**

Create `apps/dashboard/src/context/AdminAuthContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN_KEY = 'admin_token';
const TENANT_TOKEN_KEY = 'token';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

interface AdminAuthContextValue {
  adminToken: string | null;
  adminEmail: string | null;
  isImpersonating: boolean;
  impersonatedEmail: string | null;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => void;
  startImpersonation: (tenantToken: string) => void;
  stopImpersonation: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminTokenState] = useState<string | null>(
    () => localStorage.getItem(ADMIN_TOKEN_KEY),
  );

  // isImpersonating is derived — not stored in state — so it survives hard reloads
  const activeToken = localStorage.getItem(TENANT_TOKEN_KEY);
  const activePayload = activeToken ? decodeJwt(activeToken) : null;
  const isImpersonating = !!adminToken && !!activeToken && activePayload?.impersonated === true;
  const impersonatedEmail = isImpersonating ? (activePayload?.email as string) : null;

  const adminEmail = adminToken ? (decodeJwt(adminToken)?.email as string) ?? null : null;

  const adminLogin = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post<{ token: string }>(`${API_URL}/auth/admin/login`, {
      email,
      password,
    });
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setAdminTokenState(data.token);
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem('tenantId');
    localStorage.removeItem('email');
    setAdminTokenState(null);
    window.location.href = '/admin/login';
  }, []);

  const startImpersonation = useCallback((tenantToken: string) => {
    localStorage.setItem(TENANT_TOKEN_KEY, tenantToken);
    window.location.href = '/';
  }, []);

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem('tenantId');
    localStorage.removeItem('email');
    window.location.href = '/admin';
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        adminToken,
        adminEmail,
        isImpersonating,
        impersonatedEmail,
        adminLogin,
        adminLogout,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/dashboard && npx tsc --noEmit
```

Expected: No errors from the new file

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/context/AdminAuthContext.tsx
git commit -m "feat(dashboard): add AdminAuthContext with derived isImpersonating"
```

---

## Task 6: useAdmin Hooks

**Files:**
- Create: `apps/dashboard/src/hooks/api/useAdmin.ts`

- [ ] **Step 1: Create the hooks file**

Create `apps/dashboard/src/hooks/api/useAdmin.ts`:

```typescript
import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface AdminTenant {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  mpConnected: boolean;
  boothCount: number;
}

function adminAxios() {
  const token = localStorage.getItem('admin_token');
  return axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const useAdminTenants = () =>
  useQuery<AdminTenant[]>({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const { data } = await adminAxios().get('/admin/tenants');
      return data;
    },
  });

export const useImpersonate = () =>
  useMutation({
    mutationFn: async (tenantId: string) => {
      const { data } = await adminAxios().post(`/admin/impersonate/${tenantId}`);
      return data as { token: string; tenantId: string; email: string };
    },
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/dashboard && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/api/useAdmin.ts
git commit -m "feat(dashboard): add useAdminTenants and useImpersonate hooks"
```

---

## Task 7: AdminLoginPage

**Files:**
- Create: `apps/dashboard/src/pages/AdminLoginPage.tsx`
- Create: `apps/dashboard/src/pages/AdminLoginPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/src/pages/AdminLoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLoginPage } from './AdminLoginPage';

const mockAdminLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminLogin: mockAdminLogin }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    mockAdminLogin.mockReset();
    mockNavigate.mockReset();
  });

  it('renders email and password fields', () => {
    render(<AdminLoginPage />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Senha')).toBeTruthy();
  });

  it('calls adminLogin with form values on submit', async () => {
    mockAdminLogin.mockResolvedValue(undefined);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockAdminLogin).toHaveBeenCalledWith('a@a.com', 'pass123'));
  });

  it('navigates to /admin on successful login', async () => {
    mockAdminLogin.mockResolvedValue(undefined);
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('shows error message on failed login', async () => {
    mockAdminLogin.mockRejectedValue(new Error('Credenciais inválidas'));
    render(<AdminLoginPage />);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(screen.getByText('Credenciais inválidas')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/pages/AdminLoginPage.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement AdminLoginPage**

Create `apps/dashboard/src/pages/AdminLoginPage.tsx`:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Button, Input } from '../components/ui';

export const AdminLoginPage: React.FC = () => {
  const { adminLogin } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(email, password);
      navigate('/admin');
    } catch {
      setError('Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Painel de administração</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/pages/AdminLoginPage.test.tsx
```

Expected: PASS, 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminLoginPage.tsx apps/dashboard/src/pages/AdminLoginPage.test.tsx
git commit -m "feat(dashboard): add AdminLoginPage"
```

---

## Task 8: AdminTenantsPage

**Files:**
- Create: `apps/dashboard/src/pages/AdminTenantsPage.tsx`
- Create: `apps/dashboard/src/pages/AdminTenantsPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/src/pages/AdminTenantsPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminTenantsPage } from './AdminTenantsPage';

const mockStartImpersonation = vi.fn();
const mockImpersonateMutate = vi.fn();

vi.mock('../hooks/api/useAdmin', () => ({
  useAdminTenants: () => ({
    data: [
      { id: 't1', name: 'Foto Express', email: 'foto@express.com', createdAt: '2026-01-01T00:00:00.000Z', mpConnected: true, boothCount: 3 },
      { id: 't2', name: 'Studio XYZ', email: 'studio@xyz.com', createdAt: '2026-02-01T00:00:00.000Z', mpConnected: false, boothCount: 1 },
    ],
    isLoading: false,
  }),
  useImpersonate: () => ({ mutate: mockImpersonateMutate, isPending: false }),
}));

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminEmail: 'admin@photobooth.com',
    adminLogout: vi.fn(),
    startImpersonation: mockStartImpersonation,
  }),
}));

describe('AdminTenantsPage', () => {
  beforeEach(() => {
    mockStartImpersonation.mockReset();
    mockImpersonateMutate.mockReset();
  });

  it('renders tenant rows', () => {
    render(<AdminTenantsPage />);
    expect(screen.getByText('Foto Express')).toBeTruthy();
    expect(screen.getByText('Studio XYZ')).toBeTruthy();
  });

  it('shows MP connected indicator', () => {
    render(<AdminTenantsPage />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Não conectado')).toBeTruthy();
  });

  it('calls useImpersonate mutate when "Entrar como" is clicked', async () => {
    render(<AdminTenantsPage />);
    const buttons = screen.getAllByRole('button', { name: /entrar como/i });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(mockImpersonateMutate).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/pages/AdminTenantsPage.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement AdminTenantsPage**

Create `apps/dashboard/src/pages/AdminTenantsPage.tsx`:

```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button, Card, Skeleton } from '../components/ui';
import { useAdminTenants, useImpersonate } from '../hooks/api/useAdmin';
import { useAdminAuth } from '../context/AdminAuthContext';

export const AdminTenantsPage: React.FC = () => {
  const { data: tenants, isLoading } = useAdminTenants();
  const impersonate = useImpersonate();
  const { adminToken, adminEmail, adminLogout, startImpersonation } = useAdminAuth();
  const navigate = useNavigate();

  // Redirect to admin login if not authenticated as admin
  React.useEffect(() => {
    if (!adminToken) navigate('/admin/login');
  }, [adminToken, navigate]);

  const handleImpersonate = (tenantId: string) => {
    impersonate.mutate(tenantId, {
      onSuccess: (data) => startImpersonation(data.token),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-xs text-gray-400">{adminEmail}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={adminLogout}>
          <LogOut size={14} className="mr-1.5" />
          Sair
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tenants</h2>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Nome</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Cadastro</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">MP</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Cabines</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {(tenants ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-4 text-gray-500">{t.email}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      {t.mpConnected ? (
                        <span className="text-green-600 font-medium">Conectado</span>
                      ) : (
                        <span className="text-gray-400">Não conectado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{t.boothCount}</td>
                    <td className="px-6 py-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleImpersonate(t.id)}
                        loading={impersonate.isPending}
                      >
                        Entrar como
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/pages/AdminTenantsPage.test.tsx
```

Expected: PASS, 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/AdminTenantsPage.tsx apps/dashboard/src/pages/AdminTenantsPage.test.tsx
git commit -m "feat(dashboard): add AdminTenantsPage with tenant list and impersonation"
```

---

## Task 9: ImpersonationBanner

**Files:**
- Create: `apps/dashboard/src/components/ImpersonationBanner.tsx`
- Create: `apps/dashboard/src/components/ImpersonationBanner.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/dashboard/src/components/ImpersonationBanner.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImpersonationBanner } from './ImpersonationBanner';

const mockStopImpersonation = vi.fn();

const mockAdminAuthState = {
  isImpersonating: true,
  impersonatedEmail: 'tenant@example.com',
  stopImpersonation: mockStopImpersonation,
};

vi.mock('../context/AdminAuthContext', () => ({
  useAdminAuth: () => mockAdminAuthState,
}));

describe('ImpersonationBanner', () => {
  it('shows impersonated email', () => {
    render(<ImpersonationBanner />);
    expect(screen.getByText(/tenant@example.com/)).toBeTruthy();
  });

  it('calls stopImpersonation when exit button is clicked', () => {
    render(<ImpersonationBanner />);
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(mockStopImpersonation).toHaveBeenCalled();
  });

  it('renders nothing when not impersonating', () => {
    mockAdminAuthState.isImpersonating = false;
    const { container } = render(<ImpersonationBanner />);
    expect(container.firstChild).toBeNull();
    mockAdminAuthState.isImpersonating = true;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/dashboard && npx vitest run src/components/ImpersonationBanner.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement ImpersonationBanner**

Create `apps/dashboard/src/components/ImpersonationBanner.tsx`:

```typescript
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedEmail, stopImpersonation } = useAdminAuth();

  if (!isImpersonating) return null;

  return (
    <div className="w-full bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between">
      <span className="flex items-center gap-2">
        <AlertTriangle size={15} />
        Visualizando como: <strong>{impersonatedEmail}</strong>
      </span>
      <button
        onClick={stopImpersonation}
        className="ml-4 underline hover:no-underline font-semibold"
      >
        Sair da impersonação
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/dashboard && npx vitest run src/components/ImpersonationBanner.test.tsx
```

Expected: PASS, 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/ImpersonationBanner.tsx apps/dashboard/src/components/ImpersonationBanner.test.tsx
git commit -m "feat(dashboard): add ImpersonationBanner component"
```

---

## Task 10: Router + DashboardLayout Wiring

**Files:**
- Modify: `apps/dashboard/src/App.tsx`
- Modify: `apps/dashboard/src/components/DashboardLayout.tsx`

- [ ] **Step 1: Update App.tsx**

Open `apps/dashboard/src/App.tsx`. Make these changes:

**Add imports** (after the existing lazy imports):
```typescript
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminTenantsPage } from './pages/AdminTenantsPage';
```

**Update the `isPublic` check** in `AppContent` to also skip auth for admin routes:
```typescript
const isPublic =
  location.pathname.startsWith('/p/') ||
  location.pathname === '/login' ||
  location.pathname === '/register' ||
  location.pathname.startsWith('/admin');  // ← add this line
```

**Add admin routes** in the public `<Routes>` block, before the `<Route path="*">`:
```typescript
<Route path="/admin/login" element={<AdminLoginPage />} />
<Route path="/admin" element={<AdminTenantsPage />} />
```

**Wrap `<AuthProvider>` with `<AdminAuthProvider>`**:
```typescript
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminAuthProvider>        {/* ← add */}
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </AdminAuthProvider>        {/* ← add */}
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Update DashboardLayout.tsx**

Open `apps/dashboard/src/components/DashboardLayout.tsx`. Add these changes:

**Add import** at the top:
```typescript
import { ImpersonationBanner } from './ImpersonationBanner';
```

**Inside `DashboardLayout` component**, at the very start of the return statement, add `ImpersonationBanner` before any other content:
```typescript
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  // ... existing code ...
  return (
    <div className="min-h-screen bg-gray-50">
      <ImpersonationBanner />   {/* ← add as very first child */}
      {/* ... rest of existing layout JSX unchanged ... */}
    </div>
  );
};
```

- [ ] **Step 3: Run all dashboard tests**

```bash
cd apps/dashboard && npx vitest run
```

Expected: All tests pass (new + existing)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/dashboard && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/App.tsx apps/dashboard/src/components/DashboardLayout.tsx
git commit -m "feat(dashboard): wire admin routes and ImpersonationBanner into app"
```

---

## Post-Implementation Setup

Add to root `.env`:
```env
ADMIN_EMAIL=arthur@seudominio.com
ADMIN_PASSWORD_HASH=<generate with: node -e "require('bcrypt').hash('yourpassword', 10).then(console.log)">
```

Test the full flow:
1. Navigate to `http://localhost:5173/admin/login`
2. Enter admin credentials
3. See tenant list at `/admin`
4. Click "Entrar como" on any tenant
5. Verify amber banner appears at top of dashboard
6. Press F5 — banner should still appear (derived from token)
7. Click "Sair da impersonação" → returns to `/admin`
