# Plano 4C — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the entire dashboard UI using the design system from Plan 4A — responsive layout, 8 pages with charts, template management (dnd-kit), and PDF export.

**Architecture:** `DashboardLayout` handles responsive sidebar (desktop/tablet) + top header + bottom tab bar (mobile). Each page is a self-contained component using TanStack Query hooks. Charts use Recharts. PDF export uses `@react-pdf/renderer`. Template drag-and-drop uses `@dnd-kit/sortable`.

**Tech Stack:** React, TypeScript, TanStack Query, Recharts, @react-pdf/renderer, @dnd-kit/core + @dnd-kit/sortable, react-day-picker, Tailwind CSS, Vitest

---

## File Map

**New:**
- `apps/dashboard/src/hooks/api/useTemplates.ts`
- `apps/dashboard/src/hooks/api/useAnalytics.ts`
- `apps/dashboard/src/pages/FramesPage.tsx`
- `apps/dashboard/src/pages/AnalyticsPage.tsx`

**Modified:**
- `apps/dashboard/src/components/DashboardLayout.tsx` — full responsive rewrite
- `apps/dashboard/src/hooks/api/useBooths.ts` — add setBoothEvent mutation
- `apps/dashboard/src/hooks/api/useEvents.ts` — add digitalPrice, maxTemplates to types
- `apps/dashboard/src/pages/Home.tsx` — KPI cards + Recharts + activity feed
- `apps/dashboard/src/pages/BoothsPage.tsx` — grid + Drawer + active event dropdown
- `apps/dashboard/src/pages/EventsPage.tsx` — table/cards + modal with template picker
- `apps/dashboard/src/pages/GalleryPage.tsx` — grid + date/booth filters + detail modal
- `apps/dashboard/src/pages/PaymentsPage.tsx` — table + filters + CSV + PDF export
- `apps/dashboard/src/pages/SettingsPage.tsx` — logo upload (S3) + color picker + account
- `apps/dashboard/src/pages/BoothsPage.test.tsx` — update for new UI
- `apps/dashboard/src/pages/GalleryPage.test.tsx` — update for new UI
- `apps/dashboard/src/pages/PaymentsPage.test.tsx` — update for new UI
- `apps/dashboard/src/pages/SettingsPage.test.tsx` — update for new UI
- `apps/dashboard/src/App.tsx` — add /frames and /analytics routes

---

## Task 1: Install dependencies

**Files:** `apps/dashboard/package.json`

- [ ] **Step 1: Install chart and UI libraries**

```bash
cd apps/dashboard && npm install recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-day-picker @react-pdf/renderer && cd ../..
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json
git commit -m "feat(dashboard): install recharts, dnd-kit, react-day-picker, react-pdf"
```

---

## Task 2: New and updated API hooks

**Files:**
- Create: `apps/dashboard/src/hooks/api/useTemplates.ts`
- Create: `apps/dashboard/src/hooks/api/useAnalytics.ts`
- Modify: `apps/dashboard/src/hooks/api/useBooths.ts`
- Modify: `apps/dashboard/src/hooks/api/useEvents.ts`

- [ ] **Step 1: Create `apps/dashboard/src/hooks/api/useTemplates.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { ITemplate, IEventTemplate } from '@packages/shared';

export const useTemplates = () =>
  useQuery<ITemplate[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/tenant/templates');
      return data;
    },
  });

export const useUploadTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const form = new FormData();
      form.append('name', name);
      form.append('file', file);
      const { data } = await api.post('/tenant/templates', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data as ITemplate;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tenant/templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
};

export const useEventTemplates = (eventId: string | null) =>
  useQuery<IEventTemplate[]>({
    queryKey: ['event-templates', eventId],
    queryFn: async () => {
      const { data } = await api.get(`/tenant/events/${eventId}/templates`);
      return data;
    },
    enabled: !!eventId,
  });

export const useSetEventTemplates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, templateIds }: { eventId: string; templateIds: string[] }) => {
      const { data } = await api.put(`/tenant/events/${eventId}/templates`, { templateIds });
      return data as IEventTemplate[];
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['event-templates', vars.eventId] });
    },
  });
};
```

- [ ] **Step 2: Create `apps/dashboard/src/hooks/api/useAnalytics.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { IAnalyticsData } from '@packages/shared';

export const useAnalytics = (
  period: '7d' | '30d' | '90d' = '30d',
  from?: string,
  to?: string,
) =>
  useQuery<IAnalyticsData>({
    queryKey: ['analytics', period, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/tenant/analytics?${params.toString()}`);
      return data;
    },
  });
```

- [ ] **Step 3: Replace `apps/dashboard/src/hooks/api/useBooths.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IBoothWithStatus, OfflineMode } from '@packages/shared';

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
    mutationFn: async (body: { name: string; offlineMode?: OfflineMode }) => {
      const { data } = await api.post('/tenant/booths', body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booths'] }),
  });
};

export const useSetBoothEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ boothId, eventId }: { boothId: string; eventId: string | null }) => {
      const { data } = await api.put(`/tenant/booths/${boothId}/event`, { eventId });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booths'] }),
  });
};
```

- [ ] **Step 4: Replace `apps/dashboard/src/hooks/api/useEvents.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { IEvent } from '@packages/shared';

export const useEvents = () =>
  useQuery<IEvent[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await api.get('/events');
      return data;
    },
  });

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      price: number;
      photoCount: number;
      digitalPrice?: number | null;
      backgroundUrl?: string | null;
      maxTemplates?: number;
    }) => {
      const { data } = await api.post('/events', body);
      return data as IEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string;
      name: string;
      price: number;
      photoCount: number;
      digitalPrice?: number | null;
      backgroundUrl?: string | null;
      maxTemplates?: number;
    }) => {
      const { data } = await api.put(`/events/${id}`, body);
      return data as IEvent;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/events/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/hooks/api/
git commit -m "feat(dashboard): add useTemplates, useAnalytics hooks; update useBooths, useEvents"
```

---

## Task 3: DashboardLayout rewrite

**Files:**
- Modify: `apps/dashboard/src/components/DashboardLayout.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/src/components/DashboardLayout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

describe('DashboardLayout', () => {
  it('renders nav items on desktop sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <DashboardLayout><div>Content</div></DashboardLayout>
      </MemoryRouter>
    );
    expect(screen.getAllByText('Início').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cabines').length).toBeGreaterThan(0);
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('marks active route with text-primary class', () => {
    render(
      <MemoryRouter initialEntries={['/booths']}>
        <DashboardLayout><div /></DashboardLayout>
      </MemoryRouter>
    );
    const links = screen.getAllByText('Cabines');
    const activeLink = links.find((el) => el.closest('a')?.className.includes('text-primary'));
    expect(activeLink).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/components/DashboardLayout.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/dashboard/src/components/DashboardLayout.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, Calendar, Layers, Image,
  CreditCard, BarChart2, Settings, LogOut, MoreHorizontal, X,
} from 'lucide-react';
import { Avatar } from './ui';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Início',        icon: LayoutDashboard, path: '/' },
  { label: 'Cabines',       icon: Smartphone,      path: '/booths' },
  { label: 'Eventos',       icon: Calendar,        path: '/events' },
  { label: 'Molduras',      icon: Layers,          path: '/frames' },
  { label: 'Galeria',       icon: Image,           path: '/gallery' },
  { label: 'Pagamentos',    icon: CreditCard,      path: '/payments' },
  { label: 'Analytics',     icon: BarChart2,       path: '/analytics' },
  { label: 'Configurações', icon: Settings,        path: '/settings' },
];

const MOBILE_TABS = NAV_ITEMS.slice(0, 5);
const MOBILE_MORE = NAV_ITEMS.slice(5);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const sideNavClass = (path: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
    ${isActive(path)
      ? 'bg-primary-light text-primary'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── DESKTOP SIDEBAR (lg+) ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-10">
        <div className="px-5 h-16 flex items-center border-b border-gray-100">
          <span className="text-lg font-bold text-gray-900">PhotoBooth OS</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
            <Link key={path} to={path} className={sideNavClass(path)}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={user?.email} size="sm" />
            <span className="text-xs text-gray-500 truncate">{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── TABLET SIDEBAR (md–lg) ────────────────────────────── */}
      <aside className="hidden md:flex lg:hidden flex-col w-16 h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-10">
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <span className="text-sm font-black text-primary">PB</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              className={`flex items-center justify-center w-10 h-10 rounded-xl mx-auto transition-colors
                ${isActive(path) ? 'bg-primary-light text-primary' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Icon size={18} />
            </Link>
          ))}
        </nav>
        <div className="px-2 py-4 border-t border-gray-100 flex justify-center">
          <button
            onClick={logout}
            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ─────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-gray-900">PhotoBooth OS</span>
        <Avatar name={user?.email} size="sm" />
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto lg:ml-64 md:ml-16 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-100 flex items-center safe-area-bottom">
        {MOBILE_TABS.map(({ label, icon: Icon, path }) => (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
              ${isActive(path) ? 'text-primary' : 'text-gray-500'}`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-500"
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>

      {/* ── MOBILE "MORE" BOTTOM SHEET ────────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900">Mais opções</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-gray-400">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-0.5">
              {MOBILE_MORE.map(({ label, icon: Icon, path }) => (
                <button
                  key={path}
                  onClick={() => { navigate(path); setMoreOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive(path) ? 'bg-primary-light text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                onClick={() => { logout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/components/DashboardLayout.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/DashboardLayout.tsx apps/dashboard/src/components/DashboardLayout.test.tsx
git commit -m "feat(dashboard): responsive DashboardLayout — sidebar desktop, icons tablet, bottom tab mobile"
```

---

## Task 4: Home page rewrite

**Files:**
- Modify: `apps/dashboard/src/pages/Home.tsx`

- [ ] **Step 1: Write failing test**

Create/replace `apps/dashboard/src/pages/Home.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from './Home';

vi.mock('../hooks/api/useMetrics', () => ({
  useMetrics: () => ({
    data: { totalRevenue: 1500, totalSessions: 42, activeBooths: 3, conversionRate: 75 },
    isLoading: false,
  }),
}));

vi.mock('../hooks/api/useAnalytics', () => ({
  useAnalytics: () => ({ data: { series: [], topEvents: [], totalRevenue: 1500, avgTicket: 35.7, bestDay: null, mostActiveBooth: null }, isLoading: false }),
}));

vi.mock('../hooks/useDashboardSocket', () => ({
  useDashboardSocket: () => ({ recentPayments: [] }),
}));

describe('Home', () => {
  it('renders all 4 KPI cards', () => {
    render(<Home />);
    expect(screen.getByText('Faturamento Total')).toBeTruthy();
    expect(screen.getByText('Sessões de Fotos')).toBeTruthy();
    expect(screen.getByText('Cabines Online')).toBeTruthy();
    expect(screen.getByText('Taxa de Conversão')).toBeTruthy();
  });

  it('displays formatted revenue', () => {
    render(<Home />);
    expect(screen.getByText('R$ 1.500,00')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/pages/Home.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/dashboard/src/pages/Home.tsx`**

```tsx
import React from 'react';
import { TrendingUp, Camera, Monitor, Target } from 'lucide-react';
import { Card, Badge, Skeleton } from '../components/ui';
import { useMetrics } from '../hooks/api/useMetrics';
import { useAnalytics } from '../hooks/api/useAnalytics';
import { useDashboardSocket } from '../hooks/useDashboardSocket';
import {
  ResponsiveContainer, LineChart, Line,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export const Home: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics('30d');
  const { recentPayments } = useDashboardSocket();

  const kpiCards = [
    {
      label: 'Faturamento Total',
      icon: TrendingUp,
      value: metrics ? formatCurrency(metrics.totalRevenue) : '—',
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Sessões de Fotos',
      icon: Camera,
      value: metrics ? String(metrics.totalSessions) : '—',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Cabines Online',
      icon: Monitor,
      value: metrics ? String(metrics.activeBooths) : '—',
      color: 'text-sky-600 bg-sky-50',
    },
    {
      label: 'Taxa de Conversão',
      icon: Target,
      value: metrics ? `${metrics.conversionRate}%` : '—',
      color: 'text-violet-600 bg-violet-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-sm text-gray-500 mt-0.5">Últimos 30 dias</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, icon: Icon, value, color }) => (
          <Card key={label} padding="md">
            {metricsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${color}`}>
                  <Icon size={18} />
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Charts — desktop side by side, mobile: scroll snap */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory md:overflow-visible">
        {/* Revenue Chart */}
        <div className="snap-start shrink-0 w-[90vw] md:w-auto md:flex-1">
          <Card padding="md">
            <p className="text-sm font-semibold text-gray-700 mb-4">Faturamento (30d)</p>
            {analyticsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatDate} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Sessions Chart */}
        <div className="snap-start shrink-0 w-[90vw] md:w-auto md:flex-1">
          <Card padding="md">
            <p className="text-sm font-semibold text-gray-700 mb-4">Sessões por dia (30d)</p>
            {analyticsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={formatDate} />
                  <Bar dataKey="sessions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>

      {/* Activity Feed */}
      <Card padding="md">
        <p className="text-sm font-semibold text-gray-700 mb-4">Atividade recente</p>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhuma atividade recente.</p>
        ) : (
          <div className="space-y-3">
            {recentPayments.slice(0, 5).map((p: any) => (
              <div key={p.paymentId} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.eventName ?? 'Pagamento'}</p>
                  <p className="text-xs text-gray-400">{p.boothName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                  <Badge variant="success">Aprovado</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/pages/Home.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/Home.tsx apps/dashboard/src/pages/Home.test.tsx
git commit -m "feat(dashboard): Home page with KPI cards, Recharts, activity feed"
```

---

## Task 5: BoothsPage rewrite

**Files:**
- Modify: `apps/dashboard/src/pages/BoothsPage.tsx`
- Modify: `apps/dashboard/src/pages/BoothsPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Replace `apps/dashboard/src/pages/BoothsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoothsPage } from './BoothsPage';

vi.mock('../hooks/api/useBooths', () => ({
  useBooths: () => ({
    data: [
      { id: 'b-1', name: 'Cabine Salão', isOnline: true, offlineMode: 'BLOCK', activeEventId: 'ev-1', activeEvent: { id: 'ev-1', name: 'Wedding' } },
      { id: 'b-2', name: 'Cabine Jardim', isOnline: false, offlineMode: 'DEMO', activeEventId: null, activeEvent: null },
    ],
    isLoading: false,
  }),
  useCreateBooth: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useSetBoothEvent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [{ id: 'ev-1', name: 'Wedding', price: 30 }],
    isLoading: false,
  }),
}));

describe('BoothsPage', () => {
  it('renders booth cards with online/offline badges', () => {
    render(<BoothsPage />);
    expect(screen.getByText('Cabine Salão')).toBeTruthy();
    expect(screen.getByText('Cabine Jardim')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('shows active event name on booth card', () => {
    render(<BoothsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
  });

  it('opens drawer when "Configurar" is clicked', async () => {
    render(<BoothsPage />);
    fireEvent.click(screen.getAllByText('Configurar')[0]);
    await waitFor(() => {
      expect(screen.getByText('Configurar Cabine')).toBeTruthy();
    });
  });

  it('shows create form when "Nova Cabine" is clicked', async () => {
    render(<BoothsPage />);
    fireEvent.click(screen.getByText('Nova Cabine'));
    await waitFor(() => {
      expect(screen.getByText('Cadastrar Cabine')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/pages/BoothsPage.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/dashboard/src/pages/BoothsPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Card, Badge, Button, Drawer, Input, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useBooths, useCreateBooth, useSetBoothEvent } from '../hooks/api/useBooths';
import { useEvents } from '../hooks/api/useEvents';

export const BoothsPage: React.FC = () => {
  const { data: booths, isLoading } = useBooths();
  const { data: events } = useEvents();
  const createBooth = useCreateBooth();
  const setBoothEvent = useSetBoothEvent();

  const [drawerBooth, setDrawerBooth] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBooth.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => { setCreateOpen(false); setNewName(''); createBooth.reset(); },
      },
    );
  };

  const handleCreateCancel = () => { setCreateOpen(false); setNewName(''); createBooth.reset(); };

  const eventOptions = [
    { value: '', label: 'Nenhum evento' },
    ...(events ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cabines</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Nova Cabine
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : !booths?.length ? (
        <EmptyState
          title="Nenhuma cabine cadastrada"
          description="Crie sua primeira cabine para começar."
          action={{ label: 'Nova Cabine', onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {booths.map((booth) => (
            <Card key={booth.id} padding="md" className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{booth.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {booth.activeEvent?.name ?? 'Sem evento ativo'}
                  </p>
                </div>
                <Badge variant={booth.isOnline ? 'success' : 'neutral'}>
                  {booth.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDrawerBooth(booth)}
              >
                <Settings2 size={14} /> Configurar
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={handleCreateCancel} title="Cadastrar Cabine">
        <div className="space-y-4">
          <Input
            label="Nome da cabine"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Cabine Salão Principal"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={handleCreateCancel}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              loading={createBooth.isPending}
              disabled={!newName.trim()}
            >
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Config Drawer */}
      {drawerBooth && (
        <Drawer
          open
          onClose={() => setDrawerBooth(null)}
          title="Configurar Cabine"
        >
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700">{drawerBooth.name}</p>
            <Select
              label="Evento ativo"
              options={eventOptions}
              value={drawerBooth.activeEventId ?? ''}
              onChange={(e) => {
                const eventId = e.target.value || null;
                setBoothEvent.mutate(
                  { boothId: drawerBooth.id, eventId },
                  { onSuccess: (updated) => setDrawerBooth({ ...drawerBooth, activeEventId: eventId, activeEvent: events?.find((ev) => ev.id === eventId) ?? null }) },
                );
              }}
            />
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${drawerBooth.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">
                  {drawerBooth.isOnline ? 'Cabine online' : 'Cabine offline'}
                </span>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/pages/BoothsPage.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/BoothsPage.tsx apps/dashboard/src/pages/BoothsPage.test.tsx
git commit -m "feat(dashboard): BoothsPage with Drawer config, active event dropdown"
```

---

## Task 6: EventsPage rewrite

**Files:**
- Modify: `apps/dashboard/src/pages/EventsPage.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/src/pages/EventsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventsPage } from './EventsPage';

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [
      { id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4, digitalPrice: 5, maxTemplates: 3, createdAt: new Date() },
    ],
    isLoading: false,
  }),
  useCreateEvent: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useUpdateEvent: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
  useDeleteEvent: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('EventsPage', () => {
  it('renders events table with name and price', () => {
    render(<EventsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
    expect(screen.getByText('R$ 30,00')).toBeTruthy();
  });

  it('opens create modal when "Novo Evento" is clicked', async () => {
    render(<EventsPage />);
    fireEvent.click(screen.getByText('Novo Evento'));
    await waitFor(() => expect(screen.getByText('Criar Evento')).toBeTruthy());
  });

  it('create modal has digitalPrice field', async () => {
    render(<EventsPage />);
    fireEvent.click(screen.getByText('Novo Evento'));
    await waitFor(() => expect(screen.getByLabelText('Preço do digital (R$)')).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/pages/EventsPage.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/dashboard/src/pages/EventsPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Button, Modal, Input, Select, Badge, Skeleton, EmptyState } from '../components/ui';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from '../hooks/api/useEvents';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PHOTO_COUNT_OPTIONS = [
  { value: '1', label: '1 foto' },
  { value: '2', label: '2 fotos (tira)' },
  { value: '4', label: '4 fotos (grade)' },
];

const DEFAULT_FORM = {
  name: '', price: '', photoCount: '1', digitalPrice: '', maxTemplates: '5',
};

export const EventsPage: React.FC = () => {
  const { data: events, isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [modalOpen, setModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<any | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const openCreate = () => { setEditEvent(null); setForm(DEFAULT_FORM); setModalOpen(true); };
  const openEdit = (ev: any) => {
    setEditEvent(ev);
    setForm({
      name: ev.name,
      price: String(ev.price),
      photoCount: String(ev.photoCount),
      digitalPrice: ev.digitalPrice != null ? String(ev.digitalPrice) : '',
      maxTemplates: String(ev.maxTemplates ?? 5),
    });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditEvent(null);
    createEvent.reset();
    updateEvent.reset();
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      price: parseFloat(form.price),
      photoCount: parseInt(form.photoCount) as 1 | 2 | 4,
      digitalPrice: form.digitalPrice ? parseFloat(form.digitalPrice) : null,
      maxTemplates: parseInt(form.maxTemplates),
    };
    if (editEvent) {
      updateEvent.mutate({ id: editEvent.id, ...payload }, { onSuccess: closeModal });
    } else {
      createEvent.mutate(payload, { onSuccess: closeModal });
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const isPending = createEvent.isPending || updateEvent.isPending;
  const isError = createEvent.isError || updateEvent.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Novo Evento</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : !events?.length ? (
        <EmptyState
          title="Nenhum evento cadastrado"
          description="Crie um evento para configurar preços e fotos."
          action={{ label: 'Novo Evento', onClick: openCreate }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome', 'Preço', 'Fotos', 'Digital', 'Molduras', 'Ações'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{ev.name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(ev.price)}</td>
                    <td className="px-4 py-3 text-gray-600">{ev.photoCount}</td>
                    <td className="px-4 py-3">
                      {ev.digitalPrice != null
                        ? <Badge variant="primary">{formatCurrency(ev.digitalPrice)}</Badge>
                        : <Badge variant="neutral">Grátis</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-600">{ev.maxTemplates ?? 5}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(ev)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(ev.id)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {events.map((ev) => (
              <Card key={ev.id} padding="md" className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{ev.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatCurrency(ev.price)} · {ev.photoCount} foto(s)</p>
                  </div>
                  {ev.digitalPrice != null
                    ? <Badge variant="primary">Digital {formatCurrency(ev.digitalPrice)}</Badge>
                    : <Badge variant="neutral">Digital grátis</Badge>
                  }
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => openEdit(ev)}><Pencil size={13} /> Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEvent.mutate(ev.id)}><Trash2 size={13} /></Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editEvent ? 'Editar Evento' : 'Criar Evento'} maxWidth="md">
        <div className="space-y-4">
          <Input label="Nome do evento" value={form.name} onChange={f('name')} placeholder="Ex: Casamento Silva" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço por sessão (R$)" type="number" min="0" step="0.01" value={form.price} onChange={f('price')} />
            <Select
              label="Fotos por sessão"
              options={PHOTO_COUNT_OPTIONS}
              value={form.photoCount}
              onChange={f('photoCount')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço do digital (R$)"
              type="number"
              min="0"
              step="0.01"
              value={form.digitalPrice}
              onChange={f('digitalPrice')}
              hint="Vazio = download gratuito"
            />
            <Input
              label="Máx. de molduras"
              type="number"
              min="1"
              max="10"
              value={form.maxTemplates}
              onChange={f('maxTemplates')}
            />
          </div>
          {isError && (
            <p className="text-sm text-red-600">Ocorreu um erro. Tente novamente.</p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              loading={isPending}
              disabled={!form.name || !form.price}
            >
              {editEvent ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/pages/EventsPage.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/EventsPage.tsx apps/dashboard/src/pages/EventsPage.test.tsx
git commit -m "feat(dashboard): EventsPage with digitalPrice, maxTemplates, mobile cards"
```

---

## Task 7: FramesPage (new)

**Files:**
- Create: `apps/dashboard/src/pages/FramesPage.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/src/pages/FramesPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FramesPage } from './FramesPage';

vi.mock('../hooks/api/useTemplates', () => ({
  useTemplates: () => ({
    data: [
      { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', tenantId: 'tenant-1', createdAt: new Date() },
    ],
    isLoading: false,
  }),
  useUploadTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTemplate: () => ({ mutate: vi.fn() }),
  useEventTemplates: () => ({ data: [], isLoading: false }),
  useSetEventTemplates: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/api/useEvents', () => ({
  useEvents: () => ({
    data: [{ id: 'ev-1', name: 'Wedding', maxTemplates: 3 }],
    isLoading: false,
  }),
}));

describe('FramesPage', () => {
  it('renders the pool column heading', () => {
    render(<FramesPage />);
    expect(screen.getByText('Pool de Molduras')).toBeTruthy();
  });

  it('renders the event column heading', () => {
    render(<FramesPage />);
    expect(screen.getByText('Molduras do Evento')).toBeTruthy();
  });

  it('shows existing template in pool', () => {
    render(<FramesPage />);
    expect(screen.getByText('Floral')).toBeTruthy();
  });

  it('shows "Adicionar Moldura" button', () => {
    render(<FramesPage />);
    expect(screen.getByText('Adicionar Moldura')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/pages/FramesPage.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/dashboard/src/pages/FramesPage.tsx`**

```tsx
import React, { useState, useRef } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Button, Modal, Input, Select, Skeleton, EmptyState } from '../components/ui';
import {
  useTemplates, useUploadTemplate, useDeleteTemplate,
  useEventTemplates, useSetEventTemplates,
} from '../hooks/api/useTemplates';
import { useEvents } from '../hooks/api/useEvents';

function SortableItem({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm"
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab">
        <GripVertical size={16} />
      </button>
      <span className="flex-1 text-sm text-gray-700">{name}</span>
      <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export const FramesPage: React.FC = () => {
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: events } = useEvents();
  const uploadTemplate = useUploadTemplate();
  const deleteTemplate = useDeleteTemplate();
  const setEventTemplates = useSetEventTemplates();

  const [selectedEventId, setSelectedEventId] = useState('');
  const { data: eventTemplates } = useEventTemplates(selectedEventId || null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  // Sync localOrder when eventTemplates change
  React.useEffect(() => {
    if (eventTemplates) {
      setLocalOrder(eventTemplates.map((et) => et.templateId));
    }
  }, [eventTemplates]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedEvent = events?.find((e) => e.id === selectedEventId);
  const maxTemplates = selectedEvent?.maxTemplates ?? 5;

  const orderedEventTemplates = localOrder
    .map((id) => eventTemplates?.find((et) => et.templateId === id))
    .filter(Boolean) as NonNullable<typeof eventTemplates>[number][];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const newOrder = arrayMove(prev, oldIndex, newIndex);
        setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
        return newOrder;
      });
    }
  };

  const addToEvent = (templateId: string) => {
    if (localOrder.length >= maxTemplates) return;
    if (localOrder.includes(templateId)) return;
    const newOrder = [...localOrder, templateId];
    setLocalOrder(newOrder);
    setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
  };

  const removeFromEvent = (templateId: string) => {
    const newOrder = localOrder.filter((id) => id !== templateId);
    setLocalOrder(newOrder);
    setEventTemplates.mutate({ eventId: selectedEventId, templateIds: newOrder });
  };

  const handleUpload = () => {
    if (!uploadFile || !uploadName.trim()) return;
    uploadTemplate.mutate(
      { name: uploadName.trim(), file: uploadFile },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setUploadName('');
          setUploadFile(null);
        },
      },
    );
  };

  const eventOptions = [
    { value: '', label: 'Selecionar evento...' },
    ...(events ?? []).map((e) => ({ value: e.id, label: e.name })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Molduras</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Pool de Molduras ───────────────────────────── */}
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">Pool de Molduras</p>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus size={14} /> Adicionar Moldura
            </Button>
          </div>

          {templatesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !templates?.length ? (
            <EmptyState
              title="Nenhuma moldura ainda"
              description="Faça upload de arquivos PNG transparentes."
            />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {templates.map((t) => {
                const inEvent = localOrder.includes(t.id);
                return (
                  <div key={t.id} className="relative group">
                    {/* Checkerboard background for transparent PNG */}
                    <div
                      className="aspect-square rounded-xl overflow-hidden border-2 transition-colors cursor-pointer"
                      style={{ backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)', backgroundSize: '12px 12px', backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px', borderColor: inEvent ? '#4f46e5' : '#e5e7eb' }}
                      onClick={() => selectedEventId && addToEvent(t.id)}
                    >
                      <img src={t.overlayUrl} alt={t.name} className="w-full h-full object-contain" />
                      {inEvent && (
                        <div className="absolute top-1 right-1 text-primary">
                          <CheckCircle2 size={16} fill="white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-center text-gray-600 mt-1 truncate">{t.name}</p>
                    <button
                      onClick={() => deleteTemplate.mutate(t.id)}
                      className="absolute top-1 left-1 hidden group-hover:flex p-1 bg-white rounded-lg shadow text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Right: Molduras do Evento ────────────────────────── */}
        <Card padding="md" className="space-y-4">
          <p className="font-semibold text-gray-900">Molduras do Evento</p>
          <Select
            label="Evento"
            options={eventOptions}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          />

          {!selectedEventId ? (
            <p className="text-sm text-gray-400 text-center py-8">Selecione um evento para gerenciar as molduras.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {localOrder.length} / {maxTemplates} molduras — arraste para reordenar
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedEventTemplates.map((et) => (
                      <SortableItem
                        key={et.templateId}
                        id={et.templateId}
                        name={et.template.name}
                        onRemove={() => removeFromEvent(et.templateId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {localOrder.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Clique em uma moldura no pool para adicioná-la aqui.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Adicionar Moldura">
        <div className="space-y-4">
          <Input label="Nome da moldura" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Arquivo PNG</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} loading={uploadTemplate.isPending} disabled={!uploadFile || !uploadName}>
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/pages/FramesPage.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/pages/FramesPage.tsx apps/dashboard/src/pages/FramesPage.test.tsx
git commit -m "feat(dashboard): FramesPage with pool grid, dnd-kit event templates, upload modal"
```

---

## Task 8: GalleryPage + PaymentsPage rewrites

**Files:**
- Modify: `apps/dashboard/src/pages/GalleryPage.tsx`
- Modify: `apps/dashboard/src/pages/GalleryPage.test.tsx`
- Modify: `apps/dashboard/src/pages/PaymentsPage.tsx`
- Modify: `apps/dashboard/src/pages/PaymentsPage.test.tsx`

- [ ] **Step 1: Write failing test for GalleryPage**

Replace `apps/dashboard/src/pages/GalleryPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GalleryPage } from './GalleryPage';

vi.mock('../hooks/api/useGallery', () => ({
  useGallery: () => ({
    data: {
      data: [
        {
          sessionId: 's-1',
          photoUrls: ['https://s3/p1.jpg'],
          eventName: 'Wedding',
          boothName: 'Cabine 1',
          createdAt: new Date('2026-04-01'),
        },
      ],
      total: 1, page: 1, limit: 20,
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../hooks/api/useBooths', () => ({
  useBooths: () => ({ data: [{ id: 'b-1', name: 'Cabine 1' }], isLoading: false }),
}));

describe('GalleryPage', () => {
  it('renders session cards', () => {
    render(<GalleryPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
    expect(screen.getByText('Cabine 1')).toBeTruthy();
  });

  it('shows booth filter select', () => {
    render(<GalleryPage />);
    expect(screen.getByText('Todas as cabines')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Write failing test for PaymentsPage**

Replace `apps/dashboard/src/pages/PaymentsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentsPage } from './PaymentsPage';

vi.mock('../hooks/api/usePayments', () => ({
  usePayments: () => ({
    data: {
      data: [
        { id: 'p-1', amount: 30, status: 'APPROVED', eventName: 'Wedding', boothName: 'Cabine 1', paymentType: 'MAIN', createdAt: new Date('2026-04-01') },
      ],
      total: 1, page: 1, limit: 20,
    },
    isLoading: false,
    isError: false,
  }),
}));

describe('PaymentsPage', () => {
  it('renders payment row', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
    expect(screen.getByText('R$ 30,00')).toBeTruthy();
  });

  it('shows export CSV button', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('CSV')).toBeTruthy();
  });

  it('shows status filter', () => {
    render(<PaymentsPage />);
    expect(screen.getByText('Todos os status')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run — verify both fail**

```bash
cd apps/dashboard && npx vitest run src/pages/GalleryPage.test.tsx src/pages/PaymentsPage.test.tsx
```
Expected: FAIL

- [ ] **Step 4: Replace `apps/dashboard/src/pages/GalleryPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Image, Download, X } from 'lucide-react';
import { Card, Badge, Button, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useGallery } from '../hooks/api/useGallery';
import { useBooths } from '../hooks/api/useBooths';

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const GalleryPage: React.FC = () => {
  const [boothFilter, setBoothFilter] = useState('');
  const [page, setPage] = useState(1);
  const [detailSession, setDetailSession] = useState<any | null>(null);

  const { data: gallery, isLoading, isError } = useGallery({ page, limit: 20, boothId: boothFilter || undefined });
  const { data: booths } = useBooths();

  const boothOptions = [
    { value: '', label: 'Todas as cabines' },
    ...(booths ?? []).map((b) => ({ value: b.id, label: b.name })),
  ];

  const handleDownloadAll = async (urls: string[]) => {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = url.split('/').pop() ?? 'photo.jpg';
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        // individual photo download failure — continue
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Galeria</h1>
        <div className="w-48">
          <Select
            options={boothOptions}
            value={boothFilter}
            onChange={(e) => { setBoothFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      ) : isError ? (
        <p className="text-sm text-red-600">Erro ao carregar galeria. Tente novamente.</p>
      ) : !gallery?.data.length ? (
        <EmptyState
          icon={<Image size={48} />}
          title="Nenhuma sessão registrada ainda"
          description="As fotos tiradas nas cabines aparecerão aqui."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {gallery.data.map((session) => (
              <Card
                key={session.sessionId}
                padding="none"
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDetailSession(session)}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {session.photoUrls[0] ? (
                    <img src={session.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300">
                      <Image size={32} />
                    </div>
                  )}
                  {session.photoUrls.length > 1 && (
                    <Badge variant="neutral" className="absolute bottom-2 right-2">
                      {session.photoUrls.length} fotos
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-900 truncate">{session.eventName}</p>
                  <p className="text-xs text-gray-400 truncate">{session.boothName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {gallery.total > gallery.limit && (
            <div className="flex justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-gray-500 self-center">{page} / {Math.ceil(gallery.total / gallery.limit)}</span>
              <Button variant="secondary" size="sm" disabled={page >= Math.ceil(gallery.total / gallery.limit)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {detailSession && (
        <Modal open onClose={() => setDetailSession(null)} title={detailSession.eventName} maxWidth="lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{detailSession.boothName}</span>
              <span>{formatDate(detailSession.createdAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {detailSession.photoUrls.map((url: string, i: number) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-full rounded-xl object-cover" />
                  <a
                    href={url}
                    download
                    className="absolute top-2 right-2 hidden group-hover:flex p-1.5 bg-white rounded-lg shadow text-gray-600 hover:text-primary"
                  >
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleDownloadAll(detailSession.photoUrls)}>
                <Download size={14} /> Baixar tudo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Replace `apps/dashboard/src/pages/PaymentsPage.tsx`**

```tsx
import React, { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Card, Badge, Button, Select, Skeleton, EmptyState } from '../components/ui';
import { usePayments } from '../hooks/api/usePayments';
import { PaymentStatus, IPaymentRecord } from '@packages/shared';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprovado', PENDING: 'Pendente', REJECTED: 'Rejeitado', EXPIRED: 'Expirado',
};
const STATUS_VARIANTS: Record<string, any> = {
  APPROVED: 'success', PENDING: 'warning', REJECTED: 'error', EXPIRED: 'neutral',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'APPROVED', label: 'Aprovado' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'REJECTED', label: 'Rejeitado' },
  { value: 'EXPIRED', label: 'Expirado' },
];

function escapeCSV(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export const PaymentsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: paymentsData, isLoading, isError } = usePayments({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const handleExportCSV = () => {
    if (!paymentsData?.data) return;
    const rows = paymentsData.data;
    const header = ['Data', 'Evento', 'Cabine', 'Valor', 'Tipo', 'Status'];
    const lines = rows.map((p: IPaymentRecord) => [
      formatDate(p.createdAt),
      escapeCSV(p.eventName),
      escapeCSV(p.boothName),
      formatCurrency(p.amount),
      p.paymentType === 'DIGITAL' ? 'Digital' : 'Principal',
      STATUS_LABELS[p.status] ?? p.status,
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const payments = paymentsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <div className="flex gap-2">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          />
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <Download size={14} /> CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : isError ? (
        <p className="text-sm text-red-600">Erro ao carregar pagamentos. Tente novamente.</p>
      ) : !payments.length ? (
        <EmptyState title="Nenhum pagamento encontrado" description="Ajuste os filtros ou aguarde novos pagamentos." />
      ) : (
        <>
          {/* Desktop table */}
          <Card padding="none" className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Data', 'Evento', 'Cabine', 'Valor', 'Tipo', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.eventName}</td>
                    <td className="px-4 py-3 text-gray-500">{p.boothName}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.paymentType === 'DIGITAL' ? 'primary' : 'neutral'}>
                        {p.paymentType === 'DIGITAL' ? 'Digital' : 'Principal'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[p.status] ?? 'neutral'}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {payments.map((p) => (
              <Card key={p.id} padding="md">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{p.eventName}</p>
                    <p className="text-xs text-gray-400">{p.boothName} · {formatDate(p.createdAt)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[p.status] ?? 'neutral'}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(p.amount)}</span>
                  <Badge variant={p.paymentType === 'DIGITAL' ? 'primary' : 'neutral'}>
                    {p.paymentType === 'DIGITAL' ? 'Digital' : 'Principal'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {paymentsData && paymentsData.total > paymentsData.limit && (
            <div className="flex justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-gray-500 self-center">{page} / {Math.ceil(paymentsData.total / paymentsData.limit)}</span>
              <Button variant="secondary" size="sm" disabled={page >= Math.ceil(paymentsData.total / paymentsData.limit)} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 6: Run tests — verify both pass**

```bash
cd apps/dashboard && npx vitest run src/pages/GalleryPage.test.tsx src/pages/PaymentsPage.test.tsx
```
Expected: PASS (both)

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/GalleryPage.tsx apps/dashboard/src/pages/GalleryPage.test.tsx
git add apps/dashboard/src/pages/PaymentsPage.tsx apps/dashboard/src/pages/PaymentsPage.test.tsx
git commit -m "feat(dashboard): GalleryPage with filters + detail modal; PaymentsPage with CSV export"
```

---

## Task 9: AnalyticsPage + SettingsPage

**Files:**
- Create: `apps/dashboard/src/pages/AnalyticsPage.tsx`
- Modify: `apps/dashboard/src/pages/SettingsPage.tsx`
- Modify: `apps/dashboard/src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/dashboard/src/pages/AnalyticsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPage } from './AnalyticsPage';

vi.mock('../hooks/api/useAnalytics', () => ({
  useAnalytics: () => ({
    data: {
      series: [],
      totalRevenue: 2500,
      avgTicket: 30,
      bestDay: { date: '2026-04-01', revenue: 300 },
      mostActiveBooth: { name: 'Cabine Principal', sessions: 10 },
      topEvents: [{ id: 'ev-1', name: 'Wedding', revenue: 1000 }],
    },
    isLoading: false,
  }),
}));

describe('AnalyticsPage', () => {
  it('renders period selector buttons', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('7 dias')).toBeTruthy();
    expect(screen.getByText('30 dias')).toBeTruthy();
    expect(screen.getByText('90 dias')).toBeTruthy();
  });

  it('renders summary cards with correct values', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('R$ 2.500,00')).toBeTruthy();
    expect(screen.getByText('Cabine Principal')).toBeTruthy();
  });

  it('renders top events table', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('Wedding')).toBeTruthy();
  });
});
```

Replace `apps/dashboard/src/pages/SettingsPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

vi.mock('../hooks/api/useSettings', () => ({
  useSettings: () => ({
    data: { logoUrl: null, primaryColor: '#4f46e5', brandName: 'MyBrand' },
    isLoading: false,
  }),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@test.com' }, logout: vi.fn() }),
}));

describe('SettingsPage', () => {
  it('renders brand name input with current value', () => {
    render(<SettingsPage />);
    expect(screen.getByDisplayValue('MyBrand')).toBeTruthy();
  });

  it('renders color picker input with current color', () => {
    render(<SettingsPage />);
    const input = screen.getByDisplayValue('#4f46e5');
    expect(input).toBeTruthy();
  });

  it('shows logo upload area', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Enviar logo')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify both fail**

```bash
cd apps/dashboard && npx vitest run src/pages/AnalyticsPage.test.tsx src/pages/SettingsPage.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/dashboard/src/pages/AnalyticsPage.tsx`**

```tsx
import React, { useState } from 'react';
import { TrendingUp, Calendar, Monitor, Zap } from 'lucide-react';
import { Card, Button, Skeleton } from '../components/ui';
import { useAnalytics } from '../hooks/api/useAnalytics';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const PERIODS = [
  { label: '7 dias',  value: '7d'  as const },
  { label: '30 dias', value: '30d' as const },
  { label: '90 dias', value: '90d' as const },
];

export const AnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { data, isLoading } = useAnalytics(period);

  const summaryCards = data ? [
    { label: 'Faturamento total',   icon: TrendingUp, value: formatCurrency(data.totalRevenue) },
    { label: 'Ticket médio',        icon: Zap,        value: formatCurrency(data.avgTicket) },
    { label: 'Melhor dia',          icon: Calendar,   value: data.bestDay ? `${formatDate(data.bestDay.date)} · ${formatCurrency(data.bestDay.revenue)}` : '—' },
    { label: 'Cabine mais ativa',   icon: Monitor,    value: data.mostActiveBooth ? `${data.mostActiveBooth.name} (${data.mostActiveBooth.sessions} sessões)` : '—' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          : summaryCards.map(({ label, icon: Icon, value }) => (
            <Card key={label} padding="md">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-light text-primary rounded-xl">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{value}</p>
                </div>
              </div>
            </Card>
          ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-4">Faturamento acumulado</p>
          {isLoading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={formatDate} />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card padding="md">
          <p className="text-sm font-semibold text-gray-700 mb-4">Sessões por dia</p>
          {isLoading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={formatDate} />
                <Bar dataKey="sessions" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Top Events */}
      <Card padding="md">
        <p className="text-sm font-semibold text-gray-700 mb-4">Top 5 eventos por faturamento</p>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : !data?.topEvents.length ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum evento no período.</p>
        ) : (
          <div className="space-y-2">
            {data.topEvents.map((ev, i) => (
              <div key={ev.id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-gray-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{ev.name}</span>
                    <span className="text-sm font-bold text-gray-900 ml-2">{formatCurrency(ev.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(ev.revenue / data.topEvents[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
```

- [ ] **Step 4: Replace `apps/dashboard/src/pages/SettingsPage.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Eye } from 'lucide-react';
import { Card, Button, Input, Modal, Skeleton } from '../components/ui';
import { useSettings, useUpdateSettings } from '../hooks/api/useSettings';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { user } = useAuth();

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brandName ?? '');
      setPrimaryColor(settings.primaryColor ?? '#4f46e5');
    }
  }, [settings]);

  // Live preview of primary color
  useEffect(() => {
    try {
      const rgb = hexToRgb(primaryColor);
      document.documentElement.style.setProperty('--color-primary-rgb', rgb);
    } catch {}
  }, [primaryColor]);

  const handleSaveBranding = () => {
    updateSettings.mutate({ brandName, primaryColor });
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post('/tenant/settings/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* Identity / White-label */}
      <Card padding="md" className="space-y-5">
        <p className="font-semibold text-gray-900">Identidade Visual</p>

        {/* Logo upload */}
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
              if (file) handleLogoUpload(file);
            }}
          />
          {uploadingLogo && <p className="text-xs text-gray-400 mt-1">Enviando...</p>}
        </div>

        <Input
          label="Nome da marca"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Ex: PhotoBooth OS"
        />

        {/* Color picker */}
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
              title="Preview"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSaveBranding} loading={updateSettings.isPending}>
            Salvar alterações
          </Button>
        </div>
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
      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Alterar senha">
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
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button disabled={!pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm}>
              Alterar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
```

- [ ] **Step 5: Update `apps/dashboard/src/hooks/api/useSettings.ts` to add useUploadLogo**

Add to the end of the file:

```ts
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
```

- [ ] **Step 6: Run tests — verify both pass**

```bash
cd apps/dashboard && npx vitest run src/pages/AnalyticsPage.test.tsx src/pages/SettingsPage.test.tsx
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/src/pages/AnalyticsPage.tsx apps/dashboard/src/pages/AnalyticsPage.test.tsx
git add apps/dashboard/src/pages/SettingsPage.tsx apps/dashboard/src/pages/SettingsPage.test.tsx
git add apps/dashboard/src/hooks/api/useSettings.ts
git commit -m "feat(dashboard): AnalyticsPage with period selector + charts; SettingsPage with logo upload + color picker"
```

---

## Task 10: App.tsx routing update + run all tests

**Files:**
- Modify: `apps/dashboard/src/App.tsx`

- [ ] **Step 1: Replace `apps/dashboard/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { Home } from './pages/Home';
import { EventsPage } from './pages/EventsPage';
import { FramesPage } from './pages/FramesPage';
import { GuestPhoto } from './pages/GuestPhoto';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useDashboardSocket } from './hooks/useDashboardSocket';
import { BoothsPage } from './pages/BoothsPage';
import { GalleryPage } from './pages/GalleryPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

const queryClient = new QueryClient();

function DashboardSocketInit() {
  useDashboardSocket();
  return null;
}

function AppContent() {
  const location = useLocation();
  const isPublic =
    location.pathname.startsWith('/p/') ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  if (isPublic) {
    return (
      <Routes>
        <Route path="/p/:sessionId" element={<GuestPhoto />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardSocketInit />
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booths" element={<BoothsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/frames" element={<FramesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 2: Run all dashboard tests**

```bash
cd apps/dashboard && npx vitest run
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/App.tsx
git commit -m "feat(dashboard): add /frames and /analytics routes"
```
