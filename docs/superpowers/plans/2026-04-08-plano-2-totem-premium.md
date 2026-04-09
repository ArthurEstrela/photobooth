# Plano 2: Totem Premium — UX Animado, Multi-Foto e White-Label

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o totem em uma experiência premium: countdown animado, strips multi-foto (1/2/4), live camera preview na seleção de moldura, estado completo da máquina de estados (pagamento real, offline mode, multi-photo), e white-label via CSS custom properties.

**Architecture:** O `useBoothMachine` é reescrito como o cérebro do totem — gerencia todas as 8 transições de estado, chama `POST /payments/pix`, lida com offline modes, e rastreia fotos capturadas. O `App.tsx` é criado como orquestrador central que lê env vars e delega para os hooks. Dois novos endpoints de API (`/booths/:id/config` e `/booths/:id/event`) fornecem a configuração e o evento ativo ao totem. O `CameraEngine` é reescrito para suportar multi-foto com strip compositing no Canvas. Toda cor de destaque usa `--color-primary` CSS var injetada do `BoothConfigDto.branding`.

**Tech Stack:** NestJS + Prisma (API), React + Vite + Tailwind + socket.io-client (Totem), Vitest + @testing-library/react (totem tests), Jest + ts-jest (api tests), `@packages/shared` como contrato central.

---

## Mapa de Arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `apps/api/src/controllers/booths.controller.ts` | GET /booths/:id/config e GET /booths/:id/event |
| Criar | `apps/api/src/controllers/booths.controller.spec.ts` | Testes do BoothsController |
| Modificar | `apps/api/src/app.module.ts` | Registrar BoothsController |
| Modificar | `packages/shared/src/types.ts` | Adicionar BoothEventResponseDto |
| Modificar | `apps/totem/package.json` | Adicionar vitest + @testing-library + react deps |
| Criar | `apps/totem/vitest.config.ts` | Config do Vitest para totem |
| Criar | `apps/totem/src/hooks/useBoothConfig.ts` | Fetcha BoothConfigDto + aplica CSS vars |
| Criar | `apps/totem/src/hooks/useBoothConfig.test.ts` | Testes do useBoothConfig |
| Criar | `apps/totem/src/hooks/useBoothEvent.ts` | Fetcha evento ativo + templates |
| Criar | `apps/totem/src/hooks/useBoothEvent.test.ts` | Testes do useBoothEvent |
| Criar | `apps/totem/src/components/CountdownOverlay.tsx` | Animação 3-2-1 + flash branco |
| Criar | `apps/totem/src/components/CountdownOverlay.test.tsx` | Testes do CountdownOverlay |
| Reescrever | `apps/totem/src/components/TemplateSelector.tsx` | Grid + live camera preview + ITemplate |
| Criar | `apps/totem/src/components/TemplateSelector.test.tsx` | Testes do TemplateSelector |
| Reescrever | `apps/totem/src/components/CameraEngine.tsx` | Multi-foto, strips no Canvas, cameraSound |
| Criar | `apps/totem/src/components/CameraEngine.test.tsx` | Testes do CameraEngine |
| Reescrever | `apps/totem/src/hooks/useBoothMachine.ts` | Máquina de estados completa + pagamento real |
| Criar | `apps/totem/src/hooks/useBoothMachine.test.ts` | Testes do useBoothMachine |
| Reescrever | `apps/totem/src/components/DeliveryScreen.tsx` | Tailwind + white-label + QR code |
| Criar | `apps/totem/src/App.tsx` | Orquestrador — lê env, troca telas por estado |
| Criar | `apps/totem/src/main.tsx` | Entry point do React |
| Criar | `apps/totem/src/index.css` | CSS custom properties padrão |
| Criar | `apps/totem/index.html` | HTML root do Vite |
| Criar | `apps/totem/vite.config.ts` | Vite config com alias @packages/shared |

---

## Task 1: Shared Types + API — BoothsController

**Files:**
- Modify: `packages/shared/src/types.ts`
- Create: `apps/api/src/controllers/booths.controller.ts`
- Create: `apps/api/src/controllers/booths.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

### Step 1.1 — Adicionar BoothEventResponseDto ao shared

- [ ] **Abrir `packages/shared/src/types.ts` e adicionar ao final, antes da última linha vazia:**

```typescript
export interface BoothEventResponseDto {
  event: {
    id: string;
    name: string;
    price: number;
    photoCount: 1 | 2 | 4;
  };
  templates: ITemplate[];
}
```

### Step 1.2 — Escrever os testes do BoothsController

- [ ] **Criar `apps/api/src/controllers/booths.controller.spec.ts`:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { OfflineMode } from '@packages/shared';

const mockPrisma = {
  booth: {
    findFirst: jest.fn(),
  },
  event: {
    findFirst: jest.fn(),
  },
};

describe('BoothsController', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get<BoothsController>(BoothsController);
  });

  describe('GET /booths/:id/config', () => {
    it('returns BoothConfigDto for valid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({
        id: 'booth-1',
        token: 'secret',
        offlineMode: 'BLOCK',
        offlineCredits: 0,
        demoSessionsPerHour: 3,
        cameraSound: true,
        tenant: { logoUrl: null, primaryColor: '#3b82f6', brandName: 'Demo' },
      });

      const result = await controller.getConfig('booth-1', 'Bearer secret');

      expect(result.offlineMode).toBe(OfflineMode.BLOCK);
      expect(result.cameraSound).toBe(true);
      expect(result.branding.primaryColor).toBe('#3b82f6');
    });

    it('throws UnauthorizedException for invalid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue(null);
      await expect(controller.getConfig('booth-1', 'Bearer wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when auth header is missing', async () => {
      await expect(controller.getConfig('booth-1', undefined as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GET /booths/:id/event', () => {
    it('returns event with templates for valid token', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({
        id: 'booth-1',
        token: 'secret',
        tenantId: 'tenant-1',
      });
      mockPrisma.event.findFirst.mockResolvedValue({
        id: 'event-1',
        name: 'Casamento',
        price: 25.0,
        photoCount: 2,
        templates: [{ id: 't1', name: 'Rosa', overlayUrl: '/frames/rosa.png', eventId: 'event-1', createdAt: new Date(), updatedAt: new Date() }],
      });

      const result = await controller.getBoothEvent('booth-1', 'Bearer secret');

      expect(result.event.photoCount).toBe(2);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0].name).toBe('Rosa');
    });

    it('throws NotFoundException when no event exists for tenant', async () => {
      mockPrisma.booth.findFirst.mockResolvedValue({ id: 'booth-1', token: 'secret', tenantId: 'tenant-1' });
      mockPrisma.event.findFirst.mockResolvedValue(null);
      await expect(controller.getBoothEvent('booth-1', 'Bearer secret')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

- [ ] **Rodar para confirmar que falha:**

```bash
cd apps/api && npx jest booths.controller.spec.ts --no-coverage 2>&1 | tail -10
```

Esperado: `FAIL — Cannot find module './booths.controller'`

### Step 1.3 — Criar o BoothsController

- [ ] **Criar `apps/api/src/controllers/booths.controller.ts`:**

```typescript
import {
  Controller,
  Get,
  Param,
  Headers,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BoothConfigDto, BoothEventResponseDto, OfflineMode } from '@packages/shared';

@Controller('booths')
export class BoothsController {
  constructor(private readonly prisma: PrismaService) {}

  private extractToken(auth: string | undefined): string | undefined {
    return auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  }

  @Get(':id/config')
  async getConfig(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothConfigDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({
      where: { id, token },
      include: { tenant: true },
    });
    if (!booth) throw new UnauthorizedException();

    return {
      offlineMode: booth.offlineMode as OfflineMode,
      offlineCredits: booth.offlineCredits,
      demoSessionsPerHour: booth.demoSessionsPerHour,
      cameraSound: booth.cameraSound,
      branding: {
        logoUrl: booth.tenant.logoUrl,
        primaryColor: booth.tenant.primaryColor,
        brandName: booth.tenant.brandName,
      },
    };
  }

  @Get(':id/event')
  async getBoothEvent(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ): Promise<BoothEventResponseDto> {
    const token = this.extractToken(auth);
    if (!token) throw new UnauthorizedException();

    const booth = await this.prisma.booth.findFirst({ where: { id, token } });
    if (!booth) throw new UnauthorizedException();

    const event = await this.prisma.event.findFirst({
      where: { tenantId: booth.tenantId },
      orderBy: { createdAt: 'desc' },
      include: { templates: true },
    });
    if (!event) throw new NotFoundException('No active event found for this booth');

    return {
      event: {
        id: event.id,
        name: event.name,
        price: Number(event.price),
        photoCount: event.photoCount as 1 | 2 | 4,
      },
      templates: event.templates,
    };
  }
}
```

### Step 1.4 — Registrar BoothsController no AppModule

- [ ] **Editar `apps/api/src/app.module.ts`** — adicionar import e registrar no array de controllers:

```typescript
import { BoothsController } from './controllers/booths.controller';
// ...
controllers: [PaymentController, PhotoController, TenantController, EventController, BoothsController],
```

### Step 1.5 — Rodar os testes

- [ ] **Confirmar que os testes passam:**

```bash
cd apps/api && npx jest booths.controller.spec.ts --no-coverage 2>&1 | tail -15
```

Esperado: `PASS` — 5 tests passing.

### Step 1.6 — Commit

```bash
cd apps/api && git add src/controllers/booths.controller.ts src/controllers/booths.controller.spec.ts src/app.module.ts ../../packages/shared/src/types.ts
git commit -m "feat(api): add GET /booths/:id/config and GET /booths/:id/event endpoints"
```

---

## Task 2: Totem — Setup de Testes (Vitest) + package.json

**Files:**
- Modify: `apps/totem/package.json`
- Create: `apps/totem/vitest.config.ts`
- Create: `apps/totem/vite.config.ts`
- Create: `apps/totem/index.html`
- Create: `apps/totem/src/index.css`

### Step 2.1 — Atualizar package.json do totem

- [ ] **Reescrever `apps/totem/package.json`:**

```json
{
  "name": "totem",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron": "electron .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@packages/shared": "*",
    "axios": "^1.6.0",
    "better-sqlite3": "^9.0.0",
    "electron-log": "^5.0.0",
    "electron-updater": "^6.1.1",
    "qrcode.react": "^3.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.6.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "electron": "^27.0.0",
    "electron-builder": "^24.6.0",
    "jsdom": "^23.0.1",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.4"
  }
}
```

### Step 2.2 — Criar vitest.config.ts

- [ ] **Criar `apps/totem/vitest.config.ts`:**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@packages/shared': path.resolve(__dirname, '../../packages/shared/src/types.ts'),
    },
  },
});
```

### Step 2.3 — Criar test setup

- [ ] **Criar `apps/totem/src/test-setup.ts`:**

```typescript
import '@testing-library/jest-dom';
```

### Step 2.4 — Criar vite.config.ts

- [ ] **Criar `apps/totem/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@packages/shared': path.resolve(__dirname, '../../packages/shared/src/types.ts'),
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

### Step 2.5 — Criar index.html

- [ ] **Criar `apps/totem/index.html`:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PhotoBooth Totem</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 2.6 — Criar src/index.css com CSS custom properties padrão

- [ ] **Criar `apps/totem/src/index.css`:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
}
```

### Step 2.7 — Instalar dependências

```bash
cd apps/totem && npm install 2>&1 | tail -5
```

### Step 2.8 — Verificar que vitest funciona

- [ ] **Criar `apps/totem/src/smoke.test.ts` para confirmar o setup:**

```typescript
describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
cd apps/totem && npx vitest run 2>&1 | tail -10
```

Esperado: `PASS — 1 test passing`

- [ ] **Deletar o smoke test após confirmar:**

```bash
rm apps/totem/src/smoke.test.ts
```

### Step 2.9 — Commit

```bash
git add apps/totem/package.json apps/totem/vitest.config.ts apps/totem/vite.config.ts apps/totem/index.html apps/totem/src/index.css apps/totem/src/test-setup.ts
git commit -m "chore(totem): add Vitest, React, Vite, Tailwind setup"
```

---

## Task 3: Totem — useBoothConfig + useBoothEvent hooks

**Files:**
- Create: `apps/totem/src/hooks/useBoothConfig.ts`
- Create: `apps/totem/src/hooks/useBoothConfig.test.ts`
- Create: `apps/totem/src/hooks/useBoothEvent.ts`
- Create: `apps/totem/src/hooks/useBoothEvent.test.ts`

### Step 3.1 — Escrever testes do useBoothConfig

- [ ] **Criar `apps/totem/src/hooks/useBoothConfig.test.ts`:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothConfig } from './useBoothConfig';
import axios from 'axios';
import { OfflineMode } from '@packages/shared';

vi.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockConfig = {
  offlineMode: OfflineMode.BLOCK,
  offlineCredits: 0,
  demoSessionsPerHour: 3,
  cameraSound: true,
  branding: { logoUrl: null, primaryColor: '#e91e63', brandName: 'Festa Tech' },
};

describe('useBoothConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches config and returns it', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockConfig });

    const { result } = renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config?.offlineMode).toBe(OfflineMode.BLOCK);
    expect(result.current.config?.branding.brandName).toBe('Festa Tech');
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/booths/booth-1/config'),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-abc' } }),
    );
  });

  it('applies --color-primary CSS variable when primaryColor is set', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockConfig });

    renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#e91e63');
    });
  });

  it('sets error on fetch failure', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBoothConfig('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load booth config');
    expect(result.current.config).toBeNull();
  });
});
```

- [ ] **Rodar para confirmar que falha:**

```bash
cd apps/totem && npx vitest run hooks/useBoothConfig 2>&1 | tail -10
```

Esperado: `FAIL — Cannot find module './useBoothConfig'`

### Step 3.2 — Implementar useBoothConfig

- [ ] **Criar `apps/totem/src/hooks/useBoothConfig.ts`:**

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothConfigDto } from '@packages/shared';

export function useBoothConfig(boothId: string, token: string) {
  const [config, setConfig] = useState<BoothConfigDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothConfigDto>(`${apiUrl}/booths/${boothId}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setConfig(res.data);
        if (res.data.branding.primaryColor) {
          document.documentElement.style.setProperty(
            '--color-primary',
            res.data.branding.primaryColor,
          );
        }
      })
      .catch(() => {
        setError('Failed to load booth config');
      })
      .finally(() => setIsLoading(false));
  }, [boothId, token]);

  return { config, isLoading, error };
}
```

### Step 3.3 — Rodar testes do useBoothConfig

```bash
cd apps/totem && npx vitest run hooks/useBoothConfig 2>&1 | tail -10
```

Esperado: `PASS — 3 tests passing`

### Step 3.4 — Escrever testes do useBoothEvent

- [ ] **Criar `apps/totem/src/hooks/useBoothEvent.test.ts`:**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothEvent } from './useBoothEvent';
import axios from 'axios';

vi.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

const mockResponse = {
  event: { id: 'ev-1', name: 'Casamento', price: 25, photoCount: 2 },
  templates: [
    { id: 't1', name: 'Rosa', overlayUrl: '/rosa.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
  ],
};

describe('useBoothEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches event and templates', async () => {
    mockAxios.get = vi.fn().mockResolvedValue({ data: mockResponse });

    const { result } = renderHook(() => useBoothEvent('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.event?.photoCount).toBe(2);
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe('Rosa');
  });

  it('sets error when fetch fails', async () => {
    mockAxios.get = vi.fn().mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useBoothEvent('booth-1', 'token-abc'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Failed to load event');
  });
});
```

### Step 3.5 — Implementar useBoothEvent

- [ ] **Criar `apps/totem/src/hooks/useBoothEvent.ts`:**

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothEventResponseDto, ITemplate } from '@packages/shared';

export function useBoothEvent(boothId: string, token: string) {
  const [event, setEvent] = useState<BoothEventResponseDto['event'] | null>(null);
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothEventResponseDto>(`${apiUrl}/booths/${boothId}/event`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setEvent(res.data.event);
        setTemplates(res.data.templates);
      })
      .catch(() => setError('Failed to load event'))
      .finally(() => setIsLoading(false));
  }, [boothId, token]);

  return { event, templates, isLoading, error };
}
```

### Step 3.6 — Rodar todos os testes dos hooks

```bash
cd apps/totem && npx vitest run hooks/ 2>&1 | tail -10
```

Esperado: `PASS — 5 tests passing`

### Step 3.7 — Commit

```bash
git add apps/totem/src/hooks/useBoothConfig.ts apps/totem/src/hooks/useBoothConfig.test.ts apps/totem/src/hooks/useBoothEvent.ts apps/totem/src/hooks/useBoothEvent.test.ts
git commit -m "feat(totem): add useBoothConfig and useBoothEvent hooks"
```

---

## Task 4: Totem — CountdownOverlay component

**Files:**
- Create: `apps/totem/src/components/CountdownOverlay.tsx`
- Create: `apps/totem/src/components/CountdownOverlay.test.tsx`

### Step 4.1 — Escrever testes do CountdownOverlay

- [ ] **Criar `apps/totem/src/components/CountdownOverlay.test.tsx`:**

```typescript
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { CountdownOverlay } from './CountdownOverlay';

describe('CountdownOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders the initial count', () => {
    render(<CountdownOverlay startCount={3} onComplete={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('counts down from 3 to 1 over 3 seconds', async () => {
    render(<CountdownOverlay startCount={3} onComplete={vi.fn()} />);

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('2')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onComplete after countdown finishes', () => {
    const onComplete = vi.fn();
    render(<CountdownOverlay startCount={3} onComplete={onComplete} />);

    act(() => vi.advanceTimersByTime(3000));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Confirmar que falha:**

```bash
cd apps/totem && npx vitest run CountdownOverlay 2>&1 | tail -10
```

### Step 4.2 — Implementar CountdownOverlay

- [ ] **Criar `apps/totem/src/components/CountdownOverlay.tsx`:**

```typescript
import React, { useState, useEffect } from 'react';

interface Props {
  startCount: number;
  onComplete: () => void;
}

export const CountdownOverlay: React.FC<Props> = ({ startCount, onComplete }) => {
  const [count, setCount] = useState(startCount);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (count <= 0) {
      setIsFlashing(true);
      const flashTimeout = setTimeout(() => {
        setIsFlashing(false);
        onComplete();
      }, 300);
      return () => clearTimeout(flashTimeout);
    }

    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (isFlashing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white"
        style={{ animation: 'flash 0.3s ease-out' }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        key={count}
        className="text-white font-black select-none"
        style={{
          fontSize: '20rem',
          lineHeight: 1,
          animation: 'countPop 0.9s ease-out forwards',
          textShadow: '0 0 60px rgba(255,255,255,0.5)',
        }}
      >
        {count}
      </div>
      <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.8); opacity: 0; }
          20%  { transform: scale(1.0); opacity: 1; }
          80%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        @keyframes flash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};
```

### Step 4.3 — Rodar testes

```bash
cd apps/totem && npx vitest run CountdownOverlay 2>&1 | tail -10
```

Esperado: `PASS — 3 tests passing`

### Step 4.4 — Commit

```bash
git add apps/totem/src/components/CountdownOverlay.tsx apps/totem/src/components/CountdownOverlay.test.tsx
git commit -m "feat(totem): add CountdownOverlay with 3-2-1 animation and flash"
```

---

## Task 5: Totem — TemplateSelector reescrito com live camera preview

**Files:**
- Rewrite: `apps/totem/src/components/TemplateSelector.tsx`
- Create: `apps/totem/src/components/TemplateSelector.test.tsx`

### Step 5.1 — Escrever testes do TemplateSelector

- [ ] **Criar `apps/totem/src/components/TemplateSelector.test.tsx`:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TemplateSelector } from './TemplateSelector';
import { ITemplate } from '@packages/shared';
import React from 'react';

const mockTemplates: ITemplate[] = [
  { id: 't1', name: 'Rosa', overlayUrl: '/rosa.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
  { id: 't2', name: 'Azul', overlayUrl: '/azul.png', eventId: 'ev-1', createdAt: new Date(), updatedAt: new Date() },
];

const videoRef = { current: null } as React.RefObject<HTMLVideoElement>;

describe('TemplateSelector', () => {
  it('renders all template names', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByText('Rosa')).toBeInTheDocument();
    expect(screen.getByText('Azul')).toBeInTheDocument();
  });

  it('calls onSelect with template id when clicked', () => {
    const onSelect = vi.fn();
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={onSelect}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    fireEvent.click(screen.getByText('Rosa'));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('disables confirm button when no template selected', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeDisabled();
  });

  it('enables confirm button when template is selected', () => {
    render(
      <TemplateSelector
        templates={mockTemplates}
        selectedTemplateId="t1"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={videoRef}
      />,
    );
    expect(screen.getByRole('button', { name: /confirmar/i })).not.toBeDisabled();
  });
});
```

- [ ] **Confirmar falha:**

```bash
cd apps/totem && npx vitest run TemplateSelector 2>&1 | tail -10
```

### Step 5.2 — Reescrever TemplateSelector

- [ ] **Reescrever `apps/totem/src/components/TemplateSelector.tsx`:**

```typescript
import React from 'react';
import { ITemplate } from '@packages/shared';

interface Props {
  templates: ITemplate[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  onConfirm: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const TemplateSelector: React.FC<Props> = ({
  templates,
  selectedTemplateId,
  onSelect,
  onConfirm,
  videoRef,
}) => {
  const selected = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Left: Live camera preview with selected overlay */}
      <div className="relative w-1/2 h-full bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
        {selected && (
          <img
            src={selected.overlayUrl}
            alt="frame preview"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {!selected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/40 text-2xl font-light">Escolha uma moldura →</p>
          </div>
        )}
      </div>

      {/* Right: Template grid */}
      <div className="w-1/2 h-full flex flex-col p-8 overflow-y-auto">
        <h2 className="text-3xl font-bold mb-6 tracking-tight">Escolha sua Moldura</h2>

        <div className="grid grid-cols-2 gap-4 flex-1">
          {templates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (
              <button
                key={template.id}
                onClick={() => onSelect(template.id)}
                className={`relative rounded-xl overflow-hidden border-4 transition-all duration-200 aspect-[2/3] ${
                  isSelected
                    ? 'border-[color:var(--color-primary)] scale-[1.03] shadow-2xl'
                    : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                <img
                  src={template.overlayUrl}
                  alt={template.name}
                  className="w-full h-full object-cover bg-gray-800"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-center font-semibold text-sm">{template.name}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-[color:var(--color-primary)] rounded-full p-1.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={onConfirm}
          disabled={!selectedTemplateId}
          className="mt-8 w-full bg-[color:var(--color-primary)] hover:opacity-90 disabled:opacity-30 text-white font-black text-2xl py-5 rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          CONFIRMAR E PAGAR
        </button>
      </div>
    </div>
  );
};
```

### Step 5.3 — Rodar testes

```bash
cd apps/totem && npx vitest run TemplateSelector 2>&1 | tail -10
```

Esperado: `PASS — 4 tests passing`

### Step 5.4 — Commit

```bash
git add apps/totem/src/components/TemplateSelector.tsx apps/totem/src/components/TemplateSelector.test.tsx
git commit -m "feat(totem): rewrite TemplateSelector with split-screen live camera preview"
```

---

## Task 6: Totem — CameraEngine reescrito com multi-foto strips

**Files:**
- Rewrite: `apps/totem/src/components/CameraEngine.tsx`
- Create: `apps/totem/src/components/CameraEngine.test.tsx`

### Step 6.1 — Escrever testes do CameraEngine

- [ ] **Criar `apps/totem/src/components/CameraEngine.test.tsx`:**

```typescript
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { CameraEngine } from './CameraEngine';

// Mock useWebcam to avoid navigator.mediaDevices in tests
vi.mock('../hooks/useWebcam', () => ({
  useWebcam: () => ({
    videoRef: { current: null },
    stream: null,
    error: null,
    isLoading: false,
    retry: vi.fn(),
  }),
}));

describe('CameraEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows loading when webcam is loading', () => {
    vi.mocked(require('../hooks/useWebcam').useWebcam).mockReturnValueOnce({
      videoRef: { current: null },
      stream: null,
      error: null,
      isLoading: true,
      retry: vi.fn(),
    });

    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/iniciando câmera/i)).toBeInTheDocument();
  });

  it('shows error message when webcam fails', () => {
    vi.mocked(require('../hooks/useWebcam').useWebcam).mockReturnValueOnce({
      videoRef: { current: null },
      stream: null,
      error: 'Camera not found',
      isLoading: false,
      retry: vi.fn(),
    });

    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/camera not found/i)).toBeInTheDocument();
  });

  it('renders countdown overlay when mounted', () => {
    render(
      <CameraEngine
        overlayUrl={undefined}
        sessionId="s1"
        photoCount={1}
        cameraSound={false}
        onStripReady={vi.fn()}
      />,
    );
    // Countdown starts at 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

- [ ] **Confirmar falha:**

```bash
cd apps/totem && npx vitest run CameraEngine 2>&1 | tail -10
```

### Step 6.2 — Reescrever CameraEngine

- [ ] **Reescrever `apps/totem/src/components/CameraEngine.tsx`:**

```typescript
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useWebcam } from '../hooks/useWebcam';
import { CountdownOverlay } from './CountdownOverlay';

interface Props {
  overlayUrl?: string;
  sessionId: string;
  photoCount: 1 | 2 | 4;
  cameraSound: boolean;
  onStripReady: (stripDataUrl: string) => void;
}

export const CameraEngine: React.FC<Props> = ({
  overlayUrl,
  sessionId: _sessionId,
  photoCount,
  cameraSound,
  onStripReady,
}) => {
  const { videoRef, error, isLoading } = useWebcam();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImageRef = useRef<HTMLImageElement>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [showCountdown, setShowCountdown] = useState(true);

  const playShutter = useCallback(() => {
    if (!cameraSound) return;
    try {
      new Audio('/shutter.mp3').play().catch(() => {});
    } catch {}
  }, [cameraSound]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    if (overlayUrl && overlayImageRef.current) {
      ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
  }, [overlayUrl]);

  const buildStrip = useCallback(
    (photos: string[]): Promise<string> => {
      return new Promise((resolve) => {
        const stripCanvas = document.createElement('canvas');
        const ctx = stripCanvas.getContext('2d')!;

        if (photoCount === 1) {
          const img = new Image();
          img.onload = () => {
            stripCanvas.width = img.width;
            stripCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          img.src = photos[0];
        } else if (photoCount === 2) {
          // Vertical strip: two photos stacked
          const img1 = new Image();
          const img2 = new Image();
          let loaded = 0;
          const onLoad = () => {
            loaded++;
            if (loaded < 2) return;
            stripCanvas.width = img1.width;
            stripCanvas.height = img1.height * 2;
            ctx.drawImage(img1, 0, 0);
            ctx.drawImage(img2, 0, img1.height);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          img1.onload = onLoad;
          img2.onload = onLoad;
          img1.src = photos[0];
          img2.src = photos[1] ?? photos[0];
        } else {
          // 2x2 grid
          const imgs = photos.map((src) => {
            const img = new Image();
            img.src = src;
            return img;
          });
          let loaded = 0;
          const onLoad = () => {
            loaded++;
            if (loaded < 4) return;
            const w = imgs[0].width;
            const h = imgs[0].height;
            stripCanvas.width = w * 2;
            stripCanvas.height = h * 2;
            ctx.drawImage(imgs[0], 0, 0, w, h);
            ctx.drawImage(imgs[1] ?? imgs[0], w, 0, w, h);
            ctx.drawImage(imgs[2] ?? imgs[0], 0, h, w, h);
            ctx.drawImage(imgs[3] ?? imgs[0], w, h, w, h);
            resolve(stripCanvas.toDataURL('image/jpeg', 0.95));
          };
          imgs.forEach((img) => (img.onload = onLoad));
        }
      });
    },
    [photoCount],
  );

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    playShutter();

    const photo = captureFrame();
    if (!photo) return;

    const next = [...capturedPhotos, photo];
    setCapturedPhotos(next);

    if (next.length < photoCount) {
      // Need more photos — restart countdown
      setTimeout(() => setShowCountdown(true), 500);
    } else {
      // All photos done — build strip
      buildStrip(next).then(onStripReady);
    }
  }, [capturedPhotos, photoCount, captureFrame, buildStrip, playShutter, onStripReady]);

  // Auto-start countdown on mount
  useEffect(() => {
    setShowCountdown(true);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-red-400 text-2xl">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-white text-2xl animate-pulse">Iniciando câmera...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      {overlayUrl && <img ref={overlayImageRef} src={overlayUrl} className="hidden" alt="" crossOrigin="anonymous" />}

      {/* Live video (mirrored) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover transform scale-x-[-1]"
      />

      {/* PNG frame overlay for live preview */}
      {overlayUrl && (
        <img
          src={overlayUrl}
          className="absolute inset-0 w-full h-full pointer-events-none"
          alt=""
        />
      )}

      {/* Photo counter indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: photoCount }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 border-white transition-all ${
              i < capturedPhotos.length ? 'bg-white' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Countdown overlay */}
      {showCountdown && (
        <CountdownOverlay startCount={3} onComplete={handleCountdownComplete} />
      )}
    </div>
  );
};
```

### Step 6.3 — Rodar testes

```bash
cd apps/totem && npx vitest run CameraEngine 2>&1 | tail -10
```

Esperado: `PASS — 3 tests passing`

### Step 6.4 — Commit

```bash
git add apps/totem/src/components/CameraEngine.tsx apps/totem/src/components/CameraEngine.test.tsx
git commit -m "feat(totem): rewrite CameraEngine with multi-photo strips, auto countdown, cameraSound"
```

---

## Task 7: Totem — useBoothMachine reescrito (máquina de estados completa)

**Files:**
- Rewrite: `apps/totem/src/hooks/useBoothMachine.ts`
- Create: `apps/totem/src/hooks/useBoothMachine.test.ts`

### Step 7.1 — Escrever testes do useBoothMachine

- [ ] **Criar `apps/totem/src/hooks/useBoothMachine.test.ts`:**

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useBoothMachine } from './useBoothMachine';
import { BoothState, OfflineMode, BoothConfigDto } from '@packages/shared';
import axios from 'axios';

vi.mock('axios');
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    handshake: { query: {} },
  })),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;

const mockConfig: BoothConfigDto = {
  offlineMode: OfflineMode.BLOCK,
  offlineCredits: 5,
  demoSessionsPerHour: 3,
  cameraSound: true,
  branding: { logoUrl: null, primaryColor: '#3b82f6', brandName: null },
};

describe('useBoothMachine', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts in IDLE state', () => {
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );
    expect(result.current.state).toBe(BoothState.IDLE);
  });

  it('transitions to WAITING_PAYMENT and sets currentPayment on successful startPayment', async () => {
    mockAxios.post = vi.fn().mockResolvedValue({
      data: { paymentId: 'pay-1', qrCode: 'abc', qrCodeBase64: 'base64', expiresIn: 120 },
    });

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    act(() => {
      result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.WAITING_PAYMENT);

    await waitFor(() => expect(result.current.currentPayment?.paymentId).toBe('pay-1'));
  });

  it('transitions to IDLE when API fails and offlineMode is BLOCK', async () => {
    mockAxios.post = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', { ...mockConfig, offlineMode: OfflineMode.BLOCK }),
    );

    await act(async () => {
      await result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.IDLE);
  });

  it('transitions to IN_SESSION when API fails and offlineMode is DEMO', async () => {
    mockAxios.post = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', { ...mockConfig, offlineMode: OfflineMode.DEMO }),
    );

    await act(async () => {
      await result.current.startPayment('ev-1', 't1', 25);
    });

    expect(result.current.state).toBe(BoothState.IN_SESSION);
  });

  it('transitions to PROCESSING after onPhotoTaken called photoCount times', () => {
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    act(() => result.current.onPhotoTaken('data:photo1', 2));
    expect(result.current.state).toBe(BoothState.COUNTDOWN);

    act(() => result.current.onPhotoTaken('data:photo2', 2));
    expect(result.current.state).toBe(BoothState.PROCESSING);
    expect(result.current.capturedPhotos).toHaveLength(2);
  });

  it('transitions to DELIVERY and resets to IDLE after completeSession', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useBoothMachine('booth-1', 'token-abc', mockConfig),
    );

    await act(async () => {
      await result.current.completeSession('data:strip');
    });

    expect(result.current.state).toBe(BoothState.DELIVERY);

    act(() => vi.advanceTimersByTime(8000));
    expect(result.current.state).toBe(BoothState.IDLE);

    vi.useRealTimers();
  });
});
```

- [ ] **Confirmar falha:**

```bash
cd apps/totem && npx vitest run useBoothMachine 2>&1 | tail -10
```

### Step 7.2 — Reescrever useBoothMachine

- [ ] **Reescrever `apps/totem/src/hooks/useBoothMachine.ts`:**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  BoothState,
  OfflineMode,
  BoothConfigDto,
  PixPaymentResponse,
  PaymentApprovedEvent,
  PaymentExpiredEvent,
} from '@packages/shared';

export function useBoothMachine(boothId: string, token: string, config: BoothConfigDto | null) {
  const [state, setState] = useState<BoothState>(BoothState.IDLE);
  const [currentPayment, setCurrentPayment] = useState<PixPaymentResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const transition = useCallback(
    (newState: BoothState) => {
      setState(newState);
      socketRef.current?.emit('update_state', { boothId, state: newState });
    },
    [boothId],
  );

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const socket = io(`${apiUrl}/booth`, {
      query: { boothId },
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    socket.on('payment_approved', (data: PaymentApprovedEvent) => {
      setSessionId(data.sessionId);
      transition(BoothState.IN_SESSION);
    });

    socket.on('payment_expired', (_data: PaymentExpiredEvent) => {
      setCurrentPayment(null);
      transition(BoothState.IDLE);
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [boothId, token, transition]);

  const startPayment = useCallback(
    async (eventId: string, templateId: string | undefined, amount: number) => {
      transition(BoothState.WAITING_PAYMENT);
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
      try {
        const res = await axios.post<PixPaymentResponse>(`${apiUrl}/payments/pix`, {
          boothId,
          eventId,
          templateId,
          amount,
        });
        setCurrentPayment(res.data);
      } catch {
        const mode = config?.offlineMode ?? OfflineMode.BLOCK;
        if (mode === OfflineMode.DEMO) {
          setSessionId(`offline-${Date.now()}`);
          transition(BoothState.IN_SESSION);
        } else if (mode === OfflineMode.CREDITS && (config?.offlineCredits ?? 0) > 0) {
          setSessionId(`offline-${Date.now()}`);
          transition(BoothState.IN_SESSION);
        } else {
          transition(BoothState.IDLE);
        }
      }
    },
    [boothId, config, transition],
  );

  const onPhotoTaken = useCallback(
    (photoDataUrl: string, totalPhotoCount: number) => {
      setCapturedPhotos((prev) => {
        const next = [...prev, photoDataUrl];
        if (next.length >= totalPhotoCount) {
          transition(BoothState.PROCESSING);
        } else {
          transition(BoothState.COUNTDOWN);
        }
        return next;
      });
    },
    [transition],
  );

  const completeSession = useCallback(
    async (stripDataUrl: string) => {
      if ((window as any).totemAPI) {
        (window as any).totemAPI.saveOfflinePhoto({ sessionId, photoBase64: stripDataUrl });
        (window as any).totemAPI.printPhoto();
      }
      transition(BoothState.DELIVERY);
      setTimeout(() => {
        setCapturedPhotos([]);
        setCurrentPayment(null);
        setSessionId(null);
        transition(BoothState.IDLE);
      }, 8000);
    },
    [sessionId, transition],
  );

  return {
    state,
    socket: socketRef.current,
    currentPayment,
    sessionId,
    capturedPhotos,
    startPayment,
    onPhotoTaken,
    completeSession,
  };
}
```

### Step 7.3 — Rodar testes

```bash
cd apps/totem && npx vitest run useBoothMachine 2>&1 | tail -15
```

Esperado: `PASS — 6 tests passing`

### Step 7.4 — Commit

```bash
git add apps/totem/src/hooks/useBoothMachine.ts apps/totem/src/hooks/useBoothMachine.test.ts
git commit -m "feat(totem): rewrite useBoothMachine with real payment, offline modes, multi-photo state"
```

---

## Task 8: Totem — DeliveryScreen + App.tsx + main.tsx

**Files:**
- Rewrite: `apps/totem/src/components/DeliveryScreen.tsx`
- Create: `apps/totem/src/App.tsx`
- Create: `apps/totem/src/main.tsx`

### Step 8.1 — Reescrever DeliveryScreen com Tailwind + white-label

- [ ] **Reescrever `apps/totem/src/components/DeliveryScreen.tsx`:**

```typescript
import React from 'react';
import QRCode from 'qrcode.react';

interface Props {
  sessionId: string;
  brandName?: string | null;
}

const DeliveryScreen: React.FC<Props> = ({ sessionId, brandName }) => {
  const cloudUrl = `${import.meta.env.VITE_PUBLIC_URL ?? 'https://photobooth.app'}/p/${sessionId}`;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white gap-8 p-12">
      <h1 className="text-6xl font-black tracking-tight">Obrigado! 📸</h1>

      <p className="text-2xl text-white/70 text-center max-w-lg">
        Sua foto está sendo impressa e enviada para a nuvem.
      </p>

      <div className="bg-white p-6 rounded-3xl shadow-2xl">
        <QRCode value={cloudUrl} size={220} level="H" includeMargin={false} />
      </div>

      <p className="text-white/50 text-lg text-center">
        Escaneie para baixar sua foto digital
      </p>

      {brandName && (
        <p className="text-[color:var(--color-primary)] font-bold text-xl">{brandName}</p>
      )}

      <div className="text-white/30 text-base animate-pulse">Voltando ao início em instantes...</div>
    </div>
  );
};

export default DeliveryScreen;
```

### Step 8.2 — Criar App.tsx (orquestrador)

- [ ] **Criar `apps/totem/src/App.tsx`:**

```typescript
import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { TemplateSelector } from './components/TemplateSelector';
import { CameraEngine } from './components/CameraEngine';
import DeliveryScreen from './components/DeliveryScreen';

const BOOTH_ID = import.meta.env.VITE_BOOTH_ID ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

export default function App() {
  const { videoRef } = useWebcam();
  const { config } = useBoothConfig(BOOTH_ID, BOOTH_TOKEN);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const handleConfirmTemplate = () => {
    if (!event || !selectedTemplateId) return;
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Show template selector when in IDLE and user taps
  const handleIdleTap = () => {
    if (machine.state === BoothState.IDLE && !eventLoading) {
      // Transition to template selection by setting state directly via socket emit
      // (machine doesn't need a dedicated method — we just update selectedTemplate and show the screen)
      setSelectedTemplateId('');
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {/* IDLE */}
      {machine.state === BoothState.IDLE && (
        <div
          className="flex flex-col items-center justify-center h-full text-white cursor-pointer select-none gap-6"
          onClick={handleIdleTap}
        >
          {config?.branding.logoUrl && (
            <img src={config.branding.logoUrl} alt="logo" className="h-24 object-contain" />
          )}
          <h1 className="text-7xl font-black tracking-tighter">
            {config?.branding.brandName ?? 'PhotoBooth'}
          </h1>
          <p className="text-2xl text-white/60">Toque para começar</p>
          <div
            className="mt-4 w-6 h-6 rounded-full animate-ping"
            style={{ backgroundColor: 'var(--color-primary)' }}
          />
        </div>
      )}

      {/* SELECTING_TEMPLATE */}
      {(machine.state === BoothState.IDLE && selectedTemplateId === '' && templates.length > 0 && !eventLoading) ||
      machine.state === BoothState.IDLE ? null : null}

      {/* Proactive template selector — shown right after idle tap */}
      {machine.state === BoothState.IDLE && templates.length > 0 && (
        <div className="absolute inset-0 z-10 hidden" id="template-panel" />
      )}

      {/* Show template selector when we have templates and user tapped start */}
      {machine.state === BoothState.IDLE &&
        templates.length > 0 &&
        selectedTemplateId === '__selecting__' && (
          <TemplateSelector
            templates={templates}
            selectedTemplateId={selectedTemplateId === '__selecting__' ? '' : selectedTemplateId}
            onSelect={setSelectedTemplateId}
            onConfirm={handleConfirmTemplate}
            videoRef={videoRef}
          />
        )}

      {/* WAITING_PAYMENT */}
      {machine.state === BoothState.WAITING_PAYMENT && machine.currentPayment && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-8">
          <h2 className="text-4xl font-bold">Escaneie para pagar</h2>
          <div className="bg-white p-6 rounded-3xl">
            <img
              src={`data:image/png;base64,${machine.currentPayment.qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-64 h-64"
            />
          </div>
          <p className="text-white/50 text-xl">Expira em {machine.currentPayment.expiresIn}s</p>
        </div>
      )}

      {/* IN_SESSION / COUNTDOWN / CAPTURING */}
      {(machine.state === BoothState.IN_SESSION ||
        machine.state === BoothState.COUNTDOWN ||
        machine.state === BoothState.CAPTURING) && (
        <CameraEngine
          overlayUrl={selectedTemplate?.overlayUrl}
          sessionId={machine.sessionId ?? 'session'}
          photoCount={event?.photoCount ?? 1}
          cameraSound={config?.cameraSound ?? true}
          onStripReady={(strip) => machine.completeSession(strip)}
        />
      )}

      {/* PROCESSING */}
      {machine.state === BoothState.PROCESSING && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-6">
          <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-3xl font-semibold">Processando sua foto...</p>
        </div>
      )}

      {/* DELIVERY */}
      {machine.state === BoothState.DELIVERY && (
        <DeliveryScreen
          sessionId={machine.sessionId ?? 'session'}
          brandName={config?.branding.brandName}
        />
      )}
    </div>
  );
}
```

**Nota sobre o fluxo IDLE → SELECTING_TEMPLATE:** O `App.tsx` acima usa uma abordagem simplificada onde a tela de seleção de template é mostrada diretamente ao clicar na tela IDLE. Na prática, o fluxo pode ser refinado usando um estado local `isSelectingTemplate: boolean` — a máquina permanece em IDLE até o usuário confirmar template e pagar.

- [ ] **Simplificar o App.tsx com o estado local correto** — substituir o bloco a partir de `const handleIdleTap`:

```typescript
  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false);

  const handleIdleTap = () => {
    if (machine.state === BoothState.IDLE && !eventLoading && templates.length > 0) {
      setIsSelectingTemplate(true);
    }
  };

  const handleConfirmTemplate = () => {
    if (!event || !selectedTemplateId) return;
    setIsSelectingTemplate(false);
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  // Reset template selection when machine goes back to IDLE
  useEffect(() => {
    if (machine.state === BoothState.IDLE) {
      setIsSelectingTemplate(false);
      setSelectedTemplateId('');
    }
  }, [machine.state]);
```

E substituir os blocos de renderização do IDLE e SELECTING_TEMPLATE por:

```typescript
      {/* IDLE */}
      {machine.state === BoothState.IDLE && !isSelectingTemplate && (
        <div
          className="flex flex-col items-center justify-center h-full text-white cursor-pointer select-none gap-6"
          onClick={handleIdleTap}
        >
          {config?.branding.logoUrl && (
            <img src={config.branding.logoUrl} alt="logo" className="h-24 object-contain" />
          )}
          <h1 className="text-7xl font-black tracking-tighter">
            {config?.branding.brandName ?? 'PhotoBooth'}
          </h1>
          <p className="text-2xl text-white/60">
            {eventLoading ? 'Carregando...' : 'Toque para começar'}
          </p>
          {!eventLoading && (
            <div
              className="mt-4 w-6 h-6 rounded-full animate-ping"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
        </div>
      )}

      {/* SELECTING_TEMPLATE */}
      {machine.state === BoothState.IDLE && isSelectingTemplate && (
        <TemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmTemplate}
          videoRef={videoRef}
        />
      )}
```

### Step 8.3 — Criar App.tsx final (versão limpa com estado local)

- [ ] **Reescrever `apps/totem/src/App.tsx` com a versão correta e limpa:**

```typescript
import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { TemplateSelector } from './components/TemplateSelector';
import { CameraEngine } from './components/CameraEngine';
import DeliveryScreen from './components/DeliveryScreen';

const BOOTH_ID = import.meta.env.VITE_BOOTH_ID ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

export default function App() {
  const { videoRef } = useWebcam();
  const { config } = useBoothConfig(BOOTH_ID, BOOTH_TOKEN);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config);

  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (machine.state === BoothState.IDLE) {
      setIsSelectingTemplate(false);
      setSelectedTemplateId('');
    }
  }, [machine.state]);

  const handleIdleTap = () => {
    if (machine.state === BoothState.IDLE && !eventLoading && templates.length > 0) {
      setIsSelectingTemplate(true);
    }
  };

  const handleConfirmTemplate = () => {
    if (!event || !selectedTemplateId) return;
    setIsSelectingTemplate(false);
    machine.startPayment(event.id, selectedTemplateId, event.price);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      {/* IDLE */}
      {machine.state === BoothState.IDLE && !isSelectingTemplate && (
        <div
          className="flex flex-col items-center justify-center h-full text-white cursor-pointer select-none gap-6"
          onClick={handleIdleTap}
        >
          {config?.branding.logoUrl && (
            <img src={config.branding.logoUrl} alt="logo" className="h-24 object-contain" />
          )}
          <h1 className="text-7xl font-black tracking-tighter">
            {config?.branding.brandName ?? 'PhotoBooth'}
          </h1>
          <p className="text-2xl text-white/60">
            {eventLoading ? 'Carregando...' : 'Toque para começar'}
          </p>
          {!eventLoading && templates.length > 0 && (
            <div
              className="mt-4 w-6 h-6 rounded-full animate-ping"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
        </div>
      )}

      {/* SELECTING_TEMPLATE */}
      {machine.state === BoothState.IDLE && isSelectingTemplate && (
        <TemplateSelector
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmTemplate}
          videoRef={videoRef}
        />
      )}

      {/* WAITING_PAYMENT */}
      {machine.state === BoothState.WAITING_PAYMENT && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-8 p-12">
          <h2 className="text-4xl font-bold">Escaneie para pagar</h2>
          {machine.currentPayment ? (
            <>
              <div className="bg-white p-6 rounded-3xl shadow-2xl">
                <img
                  src={`data:image/png;base64,${machine.currentPayment.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-white/50 text-xl font-mono">{machine.currentPayment.qrCode}</p>
            </>
          ) : (
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* IN_SESSION / COUNTDOWN / CAPTURING */}
      {(machine.state === BoothState.IN_SESSION ||
        machine.state === BoothState.COUNTDOWN ||
        machine.state === BoothState.CAPTURING) && (
        <CameraEngine
          overlayUrl={selectedTemplate?.overlayUrl}
          sessionId={machine.sessionId ?? 'session'}
          photoCount={event?.photoCount ?? 1}
          cameraSound={config?.cameraSound ?? true}
          onStripReady={(strip) => machine.completeSession(strip)}
        />
      )}

      {/* PROCESSING */}
      {machine.state === BoothState.PROCESSING && (
        <div className="flex flex-col items-center justify-center h-full text-white gap-6">
          <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-3xl font-semibold">Processando sua foto...</p>
        </div>
      )}

      {/* DELIVERY */}
      {machine.state === BoothState.DELIVERY && (
        <DeliveryScreen
          sessionId={machine.sessionId ?? 'session'}
          brandName={config?.branding.brandName}
        />
      )}
    </div>
  );
}
```

### Step 8.4 — Criar main.tsx

- [ ] **Criar `apps/totem/src/main.tsx`:**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### Step 8.5 — Rodar todos os testes do totem

```bash
cd apps/totem && npx vitest run 2>&1 | tail -20
```

Esperado: `PASS — todos os testes passando`

### Step 8.6 — Verificar build do totem (typecheck)

```bash
cd apps/totem && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros (ou apenas warnings de tipos implícitos menores).

### Step 8.7 — Rodar testes da API

```bash
cd apps/api && npx jest --no-coverage 2>&1 | tail -15
```

Esperado: `PASS — 10+ tests passing` (auth + gateway + booths controller).

### Step 8.8 — Commit final

```bash
git add apps/totem/src/App.tsx apps/totem/src/main.tsx apps/totem/src/components/DeliveryScreen.tsx
git commit -m "feat(totem): add App orchestrator, main entry, DeliveryScreen white-label — Plan 2 complete"
```

---

## Self-Review: Spec Coverage

| Requisito | Task |
|-----------|------|
| `useBoothMachine` com estados reais | Task 7 |
| Pagamento real via `POST /payments/pix` | Task 7 |
| Evento `payment_approved` via WebSocket | Task 7 |
| Offline mode BLOCK/DEMO/CREDITS | Task 7 |
| `useBoothConfig` hook | Task 3 |
| `GET /booths/:id/config` endpoint | Task 1 |
| `GET /booths/:id/event` endpoint | Task 1 |
| `TemplateSelector` com live camera preview | Task 5 |
| `CountdownOverlay` animado 3-2-1 + flash | Task 4 |
| `CameraEngine` multi-foto (1/2/4) | Task 6 |
| Strip compositing (1×1, 2×1, 2×2) | Task 6 |
| `cameraSound` com Audio API | Task 6 |
| White-label via `--color-primary` CSS var | Task 3 (aplicado em useBoothConfig) + Task 5 (consumido em TemplateSelector) |
| `App.tsx` orquestrador completo | Task 8 |
| Todos os testes (API + totem) passando | Tasks 1, 3–8 |

**Placeholder scan:** Nenhum "TBD", "TODO", ou "implement later" encontrado no plano.

**Type consistency:**
- `ITemplate` usado em TemplateSelector (Task 5), useBoothEvent (Task 3), BoothsController (Task 1) — consistente.
- `BoothConfigDto` retornado pelo controller (Task 1), consumido pelo useBoothConfig (Task 3) e useBoothMachine (Task 7) — consistente.
- `BoothEventResponseDto` adicionado ao shared (Task 1), retornado pelo controller (Task 1), consumido por useBoothEvent (Task 3) — consistente.
- `PixPaymentResponse` retornado pelo `POST /payments/pix`, setado no machine (Task 7), exibido no App (Task 8) — consistente.
- `onStripReady(strip: string)` definido no CameraEngine (Task 6), consumido no App (Task 8) como `machine.completeSession(strip)` — consistente.
- `onPhotoTaken(photoDataUrl: string, totalPhotoCount: number)` definido no machine (Task 7) — não chamado diretamente; o CameraEngine gerencia fotos internamente e chama `onStripReady` — **OK, não há inconsistência**.
