# Device Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monitorar e configurar câmera/impressora de cada cabine remotamente pelo dashboard, com fallback local via tela de manutenção protegida por PIN no totem.

**Architecture:** O totem persiste config em localStorage e envia heartbeat de dispositivos a cada 30s via WebSocket existente. O dashboard consome esse heartbeat e pode forçar mudanças via `force_hardware_update`. Ao reconectar, o servidor prevalece. PIN de 4 dígitos protege acesso local — comparado via SHA-256 nativo (`crypto.subtle`).

**Tech Stack:** NestJS + Socket.IO (API), React + Electron + `crypto.subtle` + `navigator.mediaDevices` (totem), React + TanStack Query (dashboard), Prisma + PostgreSQL.

---

### Task 1: Tipos compartilhados

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Adicionar `devices` em `BoothConfigDto` e os 3 novos tipos de evento**

Abrir `packages/shared/src/types.ts` e aplicar as mudanças abaixo.

Substituir a interface `BoothConfigDto` existente:

```ts
export interface BoothConfigDto {
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  branding: BoothBranding;
  devices: {
    selectedCamera: string | null;
    selectedPrinter: string | null;
    maintenancePin: string | null; // SHA-256 hash
  };
}
```

Adicionar ao final do arquivo (antes do último `}`-less line, depois de `IAnalyticsData`):

```ts
export interface DeviceHeartbeatEvent {
  boothId: string;
  cameras: string[];
  printers: string[];
  selectedCamera: string | null;
  selectedPrinter: string | null;
}

export interface DeviceStatusEvent extends DeviceHeartbeatEvent {
  lastSeen: string; // ISO date string
}

export interface HardwareUpdateEvent {
  selectedCamera: string | null;
  selectedPrinter: string | null;
}
```

- [ ] **Step 2: Verificar build dos tipos**

```bash
cd apps/api && npx tsc --noEmit 2>&1
```

Expected: sem erros (warnings sobre `devices` em `BoothConfigDto` virão nas tasks seguintes).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add device management types and update BoothConfigDto"
```

---

### Task 2: Prisma — migration de campos de dispositivo

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260415000000_add_device_fields_to_booth/migration.sql`

- [ ] **Step 1: Adicionar os 3 campos ao modelo `Booth` no schema**

Em `apps/api/prisma/schema.prisma`, dentro do model `Booth`, após a linha `cameraSound Boolean @default(true)`, adicionar:

```prisma
  selectedCamera  String?
  selectedPrinter String?
  maintenancePin  String?
```

- [ ] **Step 2: Criar o arquivo de migração manualmente**

Criar `apps/api/prisma/migrations/20260415000000_add_device_fields_to_booth/migration.sql`:

```sql
ALTER TABLE "Booth" ADD COLUMN "selectedCamera"  TEXT;
ALTER TABLE "Booth" ADD COLUMN "selectedPrinter" TEXT;
ALTER TABLE "Booth" ADD COLUMN "maintenancePin"  TEXT;
```

- [ ] **Step 3: Aplicar a migração**

```bash
cd apps/api && npx prisma migrate dev 2>&1
```

Expected: `Your database is now in sync with your schema.`
O erro EPERM no final é normal no Windows enquanto a API está rodando — pode ignorar.

- [ ] **Step 4: Limpar cache incremental e verificar tipos**

```bash
cd apps/api && rm -f tsconfig.tsbuildinfo && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260415000000_add_device_fields_to_booth/
git commit -m "feat(api): add selectedCamera, selectedPrinter, maintenancePin to Booth"
```

---

### Task 3: API — incluir `devices` em `GET /booths/:id/config`

**Files:**
- Modify: `apps/api/src/controllers/booths.controller.ts`
- Test: `apps/api/src/controllers/booths.controller.spec.ts` (criar se não existir)

- [ ] **Step 1: Escrever o teste**

Criar `apps/api/src/controllers/booths.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BoothsController } from './booths.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockBooth = {
  id: 'booth-1',
  token: 'tok',
  tenantId: 'tenant-1',
  offlineMode: 'BLOCK',
  offlineCredits: 0,
  demoSessionsPerHour: 3,
  cameraSound: true,
  activeEventId: null,
  selectedCamera: 'Logitech C920',
  selectedPrinter: 'DNP RX1',
  maintenancePin: 'abc123hash',
  tenant: { logoUrl: null, primaryColor: null, brandName: 'Test' },
};

const prismaMock = {
  booth: { findFirst: jest.fn().mockResolvedValue(mockBooth) },
};

describe('BoothsController.getConfig', () => {
  let controller: BoothsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BoothsController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();
    controller = module.get(BoothsController);
  });

  it('includes devices in config response', async () => {
    const result = await controller.getConfig('booth-1', 'Bearer tok');
    expect(result.devices).toEqual({
      selectedCamera: 'Logitech C920',
      selectedPrinter: 'DNP RX1',
      maintenancePin: 'abc123hash',
    });
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/api && npx jest booths.controller.spec --no-coverage 2>&1
```

Expected: FAIL — `result.devices` is undefined.

- [ ] **Step 3: Implementar — adicionar `devices` ao retorno de `getConfig`**

Em `apps/api/src/controllers/booths.controller.ts`, no método `getConfig`, adicionar `devices` ao objeto de retorno:

```ts
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
  devices: {
    selectedCamera: booth.selectedCamera ?? null,
    selectedPrinter: booth.selectedPrinter ?? null,
    maintenancePin: booth.maintenancePin ?? null,
  },
};
```

- [ ] **Step 4: Rodar o teste**

```bash
cd apps/api && npx jest booths.controller.spec --no-coverage 2>&1
```

Expected: PASS.

- [ ] **Step 5: Verificar build**

```bash
cd apps/api && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/controllers/booths.controller.ts apps/api/src/controllers/booths.controller.spec.ts
git commit -m "feat(api): include device config in GET /booths/:id/config"
```

---

### Task 4: API — `PATCH /tenant/booths/:id/devices`

**Files:**
- Modify: `apps/api/src/controllers/tenant.controller.ts`
- Modify: `apps/api/src/gateways/booth.gateway.ts` (só o método `sendForceHardwareUpdate` — o handler completo vem na Task 5)

- [ ] **Step 1: Adicionar `sendForceHardwareUpdate` ao `BoothGateway`**

Em `apps/api/src/gateways/booth.gateway.ts`, adicionar após o método `sendPaymentExpired`:

```ts
sendForceHardwareUpdate(boothId: string, payload: HardwareUpdateEvent) {
  const entry = this.connectedBooths.get(boothId);
  if (entry) {
    this.server.to(entry.socketId).emit('force_hardware_update', payload);
    this.logger.log(`force_hardware_update sent to booth ${boothId}`);
  }
}
```

Adicionar `HardwareUpdateEvent` ao import de `@packages/shared`:
```ts
import { BoothStateUpdate, HardwareUpdateEvent } from '@packages/shared';
```

- [ ] **Step 2: Adicionar o endpoint PATCH em `tenant.controller.ts`**

Adicionar `Patch` ao import do NestJS no topo de `tenant.controller.ts`:
```ts
import { ..., Patch } from '@nestjs/common';
```

Adicionar o import de `HardwareUpdateEvent`:
```ts
import { ..., HardwareUpdateEvent } from '@packages/shared';
```

Adicionar o método após `setBoothEvent`:

```ts
@Patch('booths/:id/devices')
async updateBoothDevices(
  @Param('id') boothId: string,
  @Body() body: { selectedCamera?: string; selectedPrinter?: string; maintenancePin?: string },
  @Request() req: AuthReq,
) {
  const booth = await this.prisma.booth.findFirst({
    where: { id: boothId, tenantId: req.user.tenantId },
  });
  if (!booth) throw new NotFoundException('Booth not found');

  await this.prisma.booth.update({
    where: { id: boothId },
    data: {
      ...(body.selectedCamera !== undefined && { selectedCamera: body.selectedCamera }),
      ...(body.selectedPrinter !== undefined && { selectedPrinter: body.selectedPrinter }),
      ...(body.maintenancePin !== undefined && { maintenancePin: body.maintenancePin }),
    },
  });

  const payload: HardwareUpdateEvent = {
    selectedCamera: body.selectedCamera ?? booth.selectedCamera ?? null,
    selectedPrinter: body.selectedPrinter ?? booth.selectedPrinter ?? null,
  };
  this.boothGateway.sendForceHardwareUpdate(boothId, payload);

  return { ok: true };
}
```

- [ ] **Step 3: Verificar build**

```bash
cd apps/api && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/controllers/tenant.controller.ts apps/api/src/gateways/booth.gateway.ts
git commit -m "feat(api): add PATCH /tenant/booths/:id/devices endpoint"
```

---

### Task 5: API — handlers de heartbeat no `BoothGateway`

**Files:**
- Modify: `apps/api/src/gateways/booth.gateway.ts`

- [ ] **Step 1: Adicionar o Map de dispositivos e os imports necessários**

No topo do `booth.gateway.ts`, adicionar `DeviceHeartbeatEvent`, `DeviceStatusEvent` ao import de `@packages/shared`:

```ts
import { BoothStateUpdate, HardwareUpdateEvent, DeviceHeartbeatEvent, DeviceStatusEvent } from '@packages/shared';
```

Dentro da classe `BoothGateway`, após `private connectedBooths`:

```ts
private boothDevices = new Map<string, DeviceStatusEvent>();
```

- [ ] **Step 2: Adicionar handler `device_heartbeat`**

Após o método `handleStateUpdate`, adicionar:

```ts
@SubscribeMessage('device_heartbeat')
async handleDeviceHeartbeat(
  @MessageBody() data: DeviceHeartbeatEvent,
  @ConnectedSocket() _client: Socket,
) {
  const entry = this.connectedBooths.get(data.boothId);
  if (!entry) return;

  const status: DeviceStatusEvent = { ...data, lastSeen: new Date().toISOString() };
  this.boothDevices.set(data.boothId, status);
  this.dashboardGateway.broadcastToTenant(entry.tenantId, 'device_status', status);
}
```

- [ ] **Step 3: Adicionar handler `hardware_updated`**

Após `handleDeviceHeartbeat`:

```ts
@SubscribeMessage('hardware_updated')
async handleHardwareUpdated(
  @MessageBody() data: { boothId: string; selectedCamera: string | null; selectedPrinter: string | null },
  @ConnectedSocket() _client: Socket,
) {
  const entry = this.connectedBooths.get(data.boothId);
  if (!entry) return;

  await this.prisma.booth.update({
    where: { id: data.boothId },
    data: {
      selectedCamera: data.selectedCamera,
      selectedPrinter: data.selectedPrinter,
    },
  });

  const existing = this.boothDevices.get(data.boothId);
  if (existing) {
    const updated: DeviceStatusEvent = {
      ...existing,
      selectedCamera: data.selectedCamera,
      selectedPrinter: data.selectedPrinter,
      lastSeen: new Date().toISOString(),
    };
    this.boothDevices.set(data.boothId, updated);
    this.dashboardGateway.broadcastToTenant(entry.tenantId, 'device_status', updated);
  }

  this.logger.log(`Booth ${data.boothId} updated hardware locally`);
}
```

- [ ] **Step 4: Sync na reconexão — atualizar `handleConnection`**

No método `handleConnection`, após `this.connectedBooths.set(...)`, adicionar:

```ts
// Sync: se o banco tiver config diferente do último heartbeat, força update
const dbBooth = await this.prisma.booth.findUnique({
  where: { id: boothId },
  select: { selectedCamera: true, selectedPrinter: true },
});
const lastKnown = this.boothDevices.get(boothId);
if (
  dbBooth &&
  lastKnown &&
  (dbBooth.selectedCamera !== lastKnown.selectedCamera ||
    dbBooth.selectedPrinter !== lastKnown.selectedPrinter)
) {
  this.sendForceHardwareUpdate(boothId, {
    selectedCamera: dbBooth.selectedCamera ?? null,
    selectedPrinter: dbBooth.selectedPrinter ?? null,
  });
}
```

- [ ] **Step 5: Verificar build**

```bash
cd apps/api && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gateways/booth.gateway.ts
git commit -m "feat(api): handle device_heartbeat and hardware_updated socket events"
```

---

### Task 6: Totem — Electron IPC para impressoras

**Files:**
- Modify: `apps/totem/electron/preload.ts`
- Modify: `apps/totem/electron/main.ts`

- [ ] **Step 1: Adicionar `getPrinters` ao preload**

Em `apps/totem/electron/preload.ts`, substituir o conteúdo por:

```ts
// apps/totem/electron/preload.ts

import { contextBridge, ipcRenderer } from 'electron';

export interface PhotoData {
  sessionId: string;
  photoBase64: string;
}

contextBridge.exposeInMainWorld('totemAPI', {
  printPhoto: () => ipcRenderer.send('print-photo'),
  saveOfflinePhoto: (data: PhotoData) => ipcRenderer.send('save-offline-photo', data),
  getPrinters: (): Promise<Array<{ name: string }>> => ipcRenderer.invoke('get-printers'),
});
```

- [ ] **Step 2: Adicionar handler `get-printers` no main**

Em `apps/totem/electron/main.ts`, adicionar após o handler `print-photo` existente:

```ts
// 4. IPC Handlers: List Printers
ipcMain.handle('get-printers', () => {
  return mainWindow ? mainWindow.webContents.getPrinters() : [];
});
```

- [ ] **Step 3: Verificar build TypeScript do electron**

```bash
cd apps/totem && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/totem/electron/preload.ts apps/totem/electron/main.ts
git commit -m "feat(totem): expose getPrinters via Electron IPC"
```

---

### Task 7: Totem — `useDeviceConfig` hook (localStorage)

**Files:**
- Create: `apps/totem/src/hooks/useDeviceConfig.ts`
- Create: `apps/totem/src/hooks/useDeviceConfig.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `apps/totem/src/hooks/useDeviceConfig.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceConfig } from './useDeviceConfig';

describe('useDeviceConfig', () => {
  beforeEach(() => localStorage.clear());

  it('returns null values when localStorage is empty', () => {
    const { result } = renderHook(() => useDeviceConfig());
    expect(result.current.deviceConfig.selectedCamera).toBeNull();
    expect(result.current.deviceConfig.selectedPrinter).toBeNull();
    expect(result.current.deviceConfig.maintenancePinHash).toBeNull();
  });

  it('persists and reads back config', () => {
    const { result } = renderHook(() => useDeviceConfig());
    act(() => {
      result.current.setDeviceConfig({
        selectedCamera: 'Logitech C920',
        selectedPrinter: 'DNP RX1',
        maintenancePinHash: 'abc',
      });
    });
    expect(result.current.deviceConfig.selectedCamera).toBe('Logitech C920');
    expect(result.current.deviceConfig.selectedPrinter).toBe('DNP RX1');
  });

  it('merges partial updates', () => {
    const { result } = renderHook(() => useDeviceConfig());
    act(() => result.current.setDeviceConfig({ selectedCamera: 'C920' }));
    act(() => result.current.setDeviceConfig({ selectedPrinter: 'DNP' }));
    expect(result.current.deviceConfig.selectedCamera).toBe('C920');
    expect(result.current.deviceConfig.selectedPrinter).toBe('DNP');
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/totem && npx vitest run src/hooks/useDeviceConfig.test.ts 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar o hook**

Criar `apps/totem/src/hooks/useDeviceConfig.ts`:

```ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'booth_device_config';

export interface DeviceConfig {
  selectedCamera: string | null;
  selectedPrinter: string | null;
  maintenancePinHash: string | null;
}

function readFromStorage(): DeviceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  return { selectedCamera: null, selectedPrinter: null, maintenancePinHash: null };
}

export function useDeviceConfig() {
  const [deviceConfig, setConfigState] = useState<DeviceConfig>(readFromStorage);

  const setDeviceConfig = useCallback((partial: Partial<DeviceConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { deviceConfig, setDeviceConfig };
}
```

- [ ] **Step 4: Rodar o teste**

```bash
cd apps/totem && npx vitest run src/hooks/useDeviceConfig.test.ts 2>&1
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/hooks/useDeviceConfig.ts apps/totem/src/hooks/useDeviceConfig.test.ts
git commit -m "feat(totem): add useDeviceConfig hook for localStorage device persistence"
```

---

### Task 8: Totem — sync de dispositivos no boot via `useBoothConfig`

**Files:**
- Modify: `apps/totem/src/hooks/useBoothConfig.ts`

- [ ] **Step 1: Atualizar `useBoothConfig` para aceitar `setDeviceConfig` e sincronizar no boot**

Em `apps/totem/src/hooks/useBoothConfig.ts`, adicionar parâmetro `setDeviceConfig` e sync pós-resposta:

```ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothConfigDto } from '@packages/shared';
import { DeviceConfig } from './useDeviceConfig';

export function useBoothConfig(
  boothId: string,
  token: string,
  setDeviceConfig: (partial: Partial<DeviceConfig>) => void,
) {
  const [config, setConfig] = useState<BoothConfigDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothConfigDto>(`${apiUrl}/booths/${boothId}/config`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => {
        setConfig(res.data);
        if (res.data.branding.primaryColor) {
          document.documentElement.style.setProperty(
            '--color-primary',
            res.data.branding.primaryColor,
          );
        }
        // Sync device config from server — server is the source of truth on boot
        const { selectedCamera, selectedPrinter, maintenancePin } = res.data.devices;
        setDeviceConfig({
          selectedCamera: selectedCamera ?? null,
          selectedPrinter: selectedPrinter ?? null,
          maintenancePinHash: maintenancePin ?? null,
        });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError('Failed to load booth config');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [boothId, token, setDeviceConfig]);

  return { config, isLoading, error };
}
```

- [ ] **Step 2: Verificar build do totem**

```bash
cd apps/totem && npx tsc --noEmit 2>&1
```

Expected: erros em `App.tsx` indicando que `useBoothConfig` agora requer 3 argumentos (será corrigido na Task 14).

- [ ] **Step 3: Commit (sem build limpo — será limpo na Task 14)**

```bash
git add apps/totem/src/hooks/useBoothConfig.ts
git commit -m "feat(totem): sync device config from API on booth boot"
```

---

### Task 9: Totem — `useDeviceHeartbeat` hook

**Files:**
- Create: `apps/totem/src/hooks/useDeviceHeartbeat.ts`

O heartbeat precisa do socket, que vive dentro de `useBoothMachine`. Vamos expor o `socketRef` do machine e passar para o heartbeat.

- [ ] **Step 1: Expor `socketRef` em `useBoothMachine` e adicionar listener `force_hardware_update`**

Em `apps/totem/src/hooks/useBoothMachine.ts`:

Adicionar ao import de `@packages/shared`:
```ts
import {
  BoothState,
  OfflineMode,
  BoothConfigDto,
  PixPaymentResponse,
  PaymentApprovedEvent,
  PaymentExpiredEvent,
  HardwareUpdateEvent,
} from '@packages/shared';
```

Adicionar parâmetro `onForceHardwareUpdate` à função:
```ts
export function useBoothMachine(
  boothId: string,
  token: string,
  config: BoothConfigDto | null,
  onForceHardwareUpdate?: (update: HardwareUpdateEvent) => void,
) {
```

Dentro do `useEffect` onde o socket é criado, após o listener `payment_expired`, adicionar:
```ts
socket.on('force_hardware_update', (data: HardwareUpdateEvent) => {
  onForceHardwareUpdate?.(data);
});
```

No `return` do hook, trocar `socket: socketRef.current` por `socketRef`:
```ts
return {
  state,
  socketRef,   // ← era socket: socketRef.current
  currentPayment,
  sessionId,
  stripDataUrl,
  startPayment,
  completeSession,
  setProcessing: () => transition(BoothState.PROCESSING),
  resetToIdle,
};
```

Adicionar `onForceHardwareUpdate` ao array de dependências do `useEffect`:
```ts
}, [boothId, token, transition, onForceHardwareUpdate]);
```

- [ ] **Step 2: Criar `useDeviceHeartbeat`**

Criar `apps/totem/src/hooks/useDeviceHeartbeat.ts`:

```ts
import { useEffect, useRef, MutableRefObject } from 'react';
import { Socket } from 'socket.io-client';
import { DeviceHeartbeatEvent } from '@packages/shared';
import { DeviceConfig } from './useDeviceConfig';

const HEARTBEAT_INTERVAL_MS = 30_000;

async function buildHeartbeat(
  boothId: string,
  deviceConfig: DeviceConfig,
): Promise<DeviceHeartbeatEvent> {
  // Detect cameras via browser API
  let cameras: string[] = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => d.label || d.deviceId);
  } catch {
    cameras = [];
  }

  // Detect printers via Electron IPC
  let printers: string[] = [];
  try {
    const totemAPI = (window as any).totemAPI;
    if (totemAPI?.getPrinters) {
      const list: Array<{ name: string }> = await totemAPI.getPrinters();
      printers = list.map((p) => p.name);
    }
  } catch {
    printers = [];
  }

  return {
    boothId,
    cameras,
    printers,
    selectedCamera: deviceConfig.selectedCamera,
    selectedPrinter: deviceConfig.selectedPrinter,
  };
}

export function useDeviceHeartbeat(
  socketRef: MutableRefObject<Socket | null>,
  boothId: string,
  deviceConfig: DeviceConfig,
) {
  const deviceConfigRef = useRef(deviceConfig);
  deviceConfigRef.current = deviceConfig;

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    async function emit() {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      const payload = await buildHeartbeat(boothId, deviceConfigRef.current);
      socket.emit('device_heartbeat', payload);
    }

    // Emit immediately when socket connects
    function onConnect() {
      emit();
    }

    function setup() {
      const socket = socketRef.current;
      if (!socket) return;
      socket.on('connect', onConnect);
      // Also emit now if already connected
      if (socket.connected) emit();
      intervalId = setInterval(emit, HEARTBEAT_INTERVAL_MS);
    }

    // Try to attach immediately; if socket not ready yet, wait 100ms
    const setupTimeout = setTimeout(setup, 100);

    return () => {
      clearTimeout(setupTimeout);
      clearInterval(intervalId);
      socketRef.current?.off('connect', onConnect);
    };
  }, [boothId, socketRef]);
}
```

- [ ] **Step 3: Verificar build**

```bash
cd apps/totem && npx tsc --noEmit 2>&1
```

Expected: erros somente em `App.tsx` (que ainda não foi atualizado).

- [ ] **Step 4: Commit**

```bash
git add apps/totem/src/hooks/useDeviceHeartbeat.ts apps/totem/src/hooks/useBoothMachine.ts
git commit -m "feat(totem): add device heartbeat hook and force_hardware_update listener"
```

---

### Task 10: Totem — `PinScreen`

**Files:**
- Create: `apps/totem/src/screens/PinScreen.tsx`
- Create: `apps/totem/src/screens/PinScreen.test.tsx`

- [ ] **Step 1: Escrever o teste**

Criar `apps/totem/src/screens/PinScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PinScreen } from './PinScreen';

// SHA-256 of "1234" computed via crypto.subtle
// In tests, we mock it for simplicity
const CORRECT_PIN_HASH = 'mock-hash-1234';

vi.stubGlobal('crypto', {
  subtle: {
    digest: vi.fn(async (_algo: string, data: BufferSource) => {
      const text = new TextDecoder().decode(data);
      // Return different buffer based on input
      const encoded = new TextEncoder().encode('mock-hash-' + text);
      return encoded.buffer;
    }),
  },
});

describe('PinScreen', () => {
  it('renders numeric keypad', () => {
    render(<PinScreen pinHash={CORRECT_PIN_HASH} onSuccess={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('calls onClose when X is pressed', () => {
    const onClose = vi.fn();
    render(<PinScreen pinHash={CORRECT_PIN_HASH} onSuccess={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSuccess with correct PIN', async () => {
    const onSuccess = vi.fn();
    render(<PinScreen pinHash="mock-hash-1234" onSuccess={onSuccess} onClose={vi.fn()} />);
    // Type 1234
    fireEvent.click(screen.getByText('1'));
    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('3'));
    fireEvent.click(screen.getByText('4'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it('shows error and resets after 3 wrong attempts', async () => {
    const onClose = vi.fn();
    render(<PinScreen pinHash="mock-hash-0000" onSuccess={vi.fn()} onClose={onClose} />);
    for (let attempt = 0; attempt < 3; attempt++) {
      fireEvent.click(screen.getByText('1'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('3'));
      fireEvent.click(screen.getByText('4'));
      await waitFor(() => {});
    }
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd apps/totem && npx vitest run src/screens/PinScreen.test.tsx 2>&1
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implementar `PinScreen`**

Criar `apps/totem/src/screens/PinScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  pinHash: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

export const PinScreen: React.FC<Props> = ({ pinHash, onSuccess, onClose }) => {
  const [digits, setDigits] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);

  const handleKey = async (key: string) => {
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === '✓') {
      if (digits.length !== 4) return;
      const hash = await hashPin(digits);
      if (hash === pinHash) {
        onSuccess();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setError(true);
        setDigits('');
        setTimeout(() => setError(false), 800);
        if (next >= 3) onClose();
      }
      return;
    }
    if (digits.length < 4) setDigits((d) => d + key);
  };

  // Auto-submit when 4 digits entered
  React.useEffect(() => {
    if (digits.length === 4) handleKey('✓');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/10">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <p className="text-white font-semibold text-lg">PIN de Manutenção</p>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                error
                  ? 'bg-red-500'
                  : i < digits.length
                  ? 'bg-primary'
                  : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-14 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xl font-semibold transition-colors"
            >
              {key}
            </button>
          ))}
        </div>

        {attempts > 0 && (
          <p className="text-red-400 text-sm">
            PIN incorreto — {3 - attempts} tentativa{3 - attempts !== 1 ? 's' : ''} restante{3 - attempts !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Rodar o teste**

```bash
cd apps/totem && npx vitest run src/screens/PinScreen.test.tsx 2>&1
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/PinScreen.tsx apps/totem/src/screens/PinScreen.test.tsx
git commit -m "feat(totem): add PinScreen with SHA-256 PIN validation"
```

---

### Task 11: Totem — `MaintenanceScreen`

**Files:**
- Create: `apps/totem/src/screens/MaintenanceScreen.tsx`

- [ ] **Step 1: Implementar `MaintenanceScreen`**

Criar `apps/totem/src/screens/MaintenanceScreen.tsx`:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Printer, CheckCircle } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { DeviceConfig } from '../hooks/useDeviceConfig';

interface Props {
  boothId: string;
  socketRef: React.MutableRefObject<Socket | null>;
  deviceConfig: DeviceConfig;
  setDeviceConfig: (partial: Partial<DeviceConfig>) => void;
  onClose: () => void;
}

export const MaintenanceScreen: React.FC<Props> = ({
  boothId,
  socketRef,
  deviceConfig,
  setDeviceConfig,
  onClose,
}) => {
  const [cameras, setCameras] = useState<string[]>([]);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(deviceConfig.selectedCamera ?? '');
  const [selectedPrinter, setSelectedPrinter] = useState(deviceConfig.selectedPrinter ?? '');
  const [saved, setSaved] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Detect cameras
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => d.label || d.deviceId);
      setCameras(cams);
    }).catch(() => setCameras([]));

    // Detect printers via Electron IPC
    const totemAPI = (window as any).totemAPI;
    if (totemAPI?.getPrinters) {
      totemAPI.getPrinters().then((list: Array<{ name: string }>) => {
        setPrinters(list.map((p) => p.name));
      }).catch(() => setPrinters([]));
    }
  }, []);

  const handleTestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPreviewStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }, 3000);
    } catch {
      // camera access denied
    }
  };

  const handleTestPrinter = () => {
    const totemAPI = (window as any).totemAPI;
    totemAPI?.printPhoto?.();
  };

  const handleSave = () => {
    setDeviceConfig({ selectedCamera: selectedCamera || null, selectedPrinter: selectedPrinter || null });
    socketRef.current?.emit('hardware_updated', {
      boothId,
      selectedCamera: selectedCamera || null,
      selectedPrinter: selectedPrinter || null,
    });
    setSaved(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-3xl p-8 w-96 flex flex-col gap-6 shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-white font-bold text-xl">🔧 Manutenção</p>
          <button
            aria-label="Fechar manutenção"
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium flex items-center gap-2">
            <Camera size={14} /> Câmera
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:outline-none focus:border-primary"
          >
            <option value="">Selecione uma câmera</option>
            {cameras.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleTestCamera}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Testar Câmera
          </button>
          {previewStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full rounded-xl mt-2 aspect-video object-cover"
            />
          )}
        </div>

        {/* Printer */}
        <div className="space-y-2">
          <label className="text-white/70 text-sm font-medium flex items-center gap-2">
            <Printer size={14} /> Impressora
          </label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:outline-none focus:border-primary"
          >
            <option value="">Selecione uma impressora</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={handleTestPrinter}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Testar Impressora
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saved}
          className="w-full py-3 bg-primary hover:opacity-90 disabled:opacity-60 text-white rounded-2xl font-semibold text-sm transition-opacity flex items-center justify-center gap-2"
        >
          {saved ? (
            <><CheckCircle size={16} /> Salvo!</>
          ) : (
            'Salvar e Voltar'
          )}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar build**

```bash
cd apps/totem && npx tsc --noEmit 2>&1
```

Expected: erros somente em `App.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/totem/src/screens/MaintenanceScreen.tsx
git commit -m "feat(totem): add MaintenanceScreen for local hardware configuration"
```

---

### Task 12: Totem — zona secreta no `IdleScreen`

**Files:**
- Modify: `apps/totem/src/screens/IdleScreen.tsx`
- Modify: `apps/totem/src/screens/IdleScreen.test.tsx`

- [ ] **Step 1: Escrever o teste da zona secreta**

Em `apps/totem/src/screens/IdleScreen.test.tsx`, adicionar no final do `describe`:

```ts
it('calls onSecretTap after 5 taps in the secret zone within 3s', () => {
  vi.useFakeTimers();
  const onSecretTap = vi.fn();
  render(
    <IdleScreen
      brandName="Test"
      logoUrl={null}
      backgroundUrl={null}
      eventLoading={false}
      hasEvent
      hasTemplates
      onTap={vi.fn()}
      onSecretTap={onSecretTap}
    />,
  );
  const zone = screen.getByTestId('secret-tap-zone');
  for (let i = 0; i < 5; i++) fireEvent.click(zone);
  expect(onSecretTap).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it('resets tap count after 3s without completing 5 taps', () => {
  vi.useFakeTimers();
  const onSecretTap = vi.fn();
  render(
    <IdleScreen
      brandName="Test"
      logoUrl={null}
      backgroundUrl={null}
      eventLoading={false}
      hasEvent
      hasTemplates
      onTap={vi.fn()}
      onSecretTap={onSecretTap}
    />,
  );
  const zone = screen.getByTestId('secret-tap-zone');
  fireEvent.click(zone);
  fireEvent.click(zone);
  vi.advanceTimersByTime(3100);
  fireEvent.click(zone);
  fireEvent.click(zone);
  fireEvent.click(zone);
  fireEvent.click(zone);
  fireEvent.click(zone);
  // Count reset after timeout, so only 5 new taps fire
  expect(onSecretTap).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
```

Também corrigir os testes existentes que não passam `hasTemplates` adicionando `hasTemplates` onde necessário:

```ts
// No teste "calls onTap when tapped and has event", adicionar hasTemplates:
render(
  <IdleScreen
    brandName="MyBooth"
    logoUrl={null}
    backgroundUrl={null}
    eventLoading={false}
    hasEvent
    hasTemplates   // ← adicionar
    onTap={onTap}
  />,
);
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd apps/totem && npx vitest run src/screens/IdleScreen.test.tsx 2>&1
```

Expected: FAIL nos novos testes.

- [ ] **Step 3: Implementar a zona secreta no `IdleScreen`**

Em `apps/totem/src/screens/IdleScreen.tsx`, atualizar a interface e o componente:

```tsx
import React, { useRef, useCallback } from 'react';

interface IdleScreenProps {
  brandName: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  eventLoading: boolean;
  hasEvent: boolean;
  hasTemplates: boolean;
  onTap: () => void;
  onSecretTap?: () => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  brandName,
  logoUrl,
  backgroundUrl,
  eventLoading,
  hasEvent,
  hasTemplates,
  onTap,
  onSecretTap,
}) => {
  const tapCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretTap = useCallback(() => {
    tapCountRef.current += 1;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 3000);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      clearTimeout(resetTimerRef.current!);
      onSecretTap?.();
    }
  }, [onSecretTap]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ backgroundColor: backgroundUrl ? 'transparent' : '#0f0f0f' }}
    >
      {/* Secret tap zone — invisible, top-left corner */}
      <div
        data-testid="secret-tap-zone"
        onClick={handleSecretTap}
        className="absolute top-0 left-0 w-[100px] h-[100px] z-20"
        style={{ opacity: 0 }}
      />

      {/* Background image */}
      {backgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
        {logoUrl && (
          <img src={logoUrl} alt="logo" className="h-24 object-contain drop-shadow-lg" />
        )}

        <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-lg">
          {brandName ?? 'PhotoBooth'}
        </h1>

        {eventLoading ? (
          <p className="text-2xl text-white/60 font-medium">Carregando evento...</p>
        ) : !hasEvent ? (
          <p className="text-2xl text-white/40 font-medium">Cabine não vinculada a um evento</p>
        ) : !hasTemplates ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-2xl text-amber-400/80 font-medium">Evento sem molduras</p>
            <p className="text-base text-white/50">Vincule pelo menos uma moldura no Dashboard</p>
          </div>
        ) : (
          <button
            onClick={onTap}
            className="group mt-4 flex flex-col items-center gap-4 focus:outline-none"
            aria-label="Iniciar sessão"
          >
            <div className="w-8 h-8 rounded-full bg-primary animate-ping opacity-80" />
            <p className="text-2xl text-white/70 font-medium group-hover:text-white transition-colors">
              Toque para começar
            </p>
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Rodar os testes**

```bash
cd apps/totem && npx vitest run src/screens/IdleScreen.test.tsx 2>&1
```

Expected: PASS (todos os testes).

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/IdleScreen.tsx apps/totem/src/screens/IdleScreen.test.tsx
git commit -m "feat(totem): add secret tap zone to IdleScreen (5 taps = maintenance access)"
```

---

### Task 13: Totem — `App.tsx` — orquestrar tudo

**Files:**
- Modify: `apps/totem/src/App.tsx`

- [ ] **Step 1: Atualizar `App.tsx` com todas as novas peças**

Substituir o conteúdo de `apps/totem/src/App.tsx` por:

```tsx
import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { useDeviceConfig } from './hooks/useDeviceConfig';
import { useDeviceHeartbeat } from './hooks/useDeviceHeartbeat';
import { CameraEngine } from './components/CameraEngine';
import { IdleScreen } from './screens/IdleScreen';
import { FrameSelectionScreen } from './screens/FrameSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';
import { PinScreen } from './screens/PinScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';

const BOOTH_ID    = import.meta.env.VITE_BOOTH_ID    ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const { videoRef } = useWebcam();
  const { deviceConfig, setDeviceConfig } = useDeviceConfig();
  const { config }   = useBoothConfig(BOOTH_ID, BOOTH_TOKEN, setDeviceConfig);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config, setDeviceConfig);

  useDeviceHeartbeat(machine.socketRef, BOOTH_ID, deviceConfig);

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

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-950">

      {/* ── IDLE ─────────────────────────────────────────────── */}
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

      {/* ── SELECTING FRAME ───────────────────────────────────── */}
      {machine.state === BoothState.IDLE && isSelectingFrame && (
        <FrameSelectionScreen
          templates={templates}
          selectedId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          onConfirm={handleConfirmFrame}
          videoRef={videoRef}
        />
      )}

      {/* ── WAITING PAYMENT ───────────────────────────────────── */}
      {machine.state === BoothState.WAITING_PAYMENT && (
        <PaymentScreen
          amount={event?.price ?? 0}
          payment={machine.currentPayment ?? null}
          onCancel={() => machine.startPayment('', '', 0)}
        />
      )}

      {/* ── IN SESSION / COUNTDOWN / CAPTURING ───────────────── */}
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

      {/* ── PROCESSING ────────────────────────────────────────── */}
      {machine.state === BoothState.PROCESSING && (
        <ProcessingScreen photoCount={event?.photoCount ?? 1} />
      )}

      {/* ── DELIVERY ──────────────────────────────────────────── */}
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

      {/* ── MAINTENANCE OVERLAYS (z-50, above everything) ─────── */}
      {showPin && (
        <PinScreen
          pinHash={deviceConfig.maintenancePinHash}
          onSuccess={() => { setShowPin(false); setShowMaintenance(true); }}
          onClose={() => setShowPin(false)}
        />
      )}
      {showMaintenance && (
        <MaintenanceScreen
          boothId={BOOTH_ID}
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

Note: `useBoothMachine` agora precisa aceitar `setDeviceConfig` como `onForceHardwareUpdate`. Atualizar a chamada em `useBoothMachine.ts` para mapear corretamente:

Em `useBoothMachine.ts`, o listener `force_hardware_update` deve chamar `onForceHardwareUpdate` com o payload. O `setDeviceConfig` do `useDeviceConfig` espera `Partial<DeviceConfig>` com `selectedCamera` e `selectedPrinter`. O payload de `HardwareUpdateEvent` tem exatamente esses campos. Portanto, passar `setDeviceConfig` diretamente como `onForceHardwareUpdate` funciona.

- [ ] **Step 2: Verificar build completo**

```bash
cd apps/totem && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 3: Rodar todos os testes do totem**

```bash
cd apps/totem && npx vitest run 2>&1
```

Expected: PASS em todos.

- [ ] **Step 4: Commit**

```bash
git add apps/totem/src/App.tsx
git commit -m "feat(totem): wire up device config, heartbeat, and maintenance screens in App"
```

---

### Task 14: Dashboard — `useDashboardSocket` ouve `device_status`

**Files:**
- Modify: `apps/dashboard/src/hooks/useDashboardSocket.ts`

- [ ] **Step 1: Adicionar listener `device_status`**

Em `apps/dashboard/src/hooks/useDashboardSocket.ts`, adicionar o import de `DeviceStatusEvent`:

```ts
import { DeviceStatusEvent } from '@packages/shared';
```

Adicionar dentro do `useEffect`, após o listener `booth_status`:

```ts
socket.on('device_status', (data: DeviceStatusEvent) => {
  queryClient.setQueryData(['booth_devices', data.boothId], {
    ...data,
    lastSeen: data.lastSeen,
  });
});
```

- [ ] **Step 2: Verificar build**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/useDashboardSocket.ts
git commit -m "feat(dashboard): listen to device_status WebSocket events"
```

---

### Task 15: Dashboard — `useUpdateBoothDevices` mutation

**Files:**
- Modify: `apps/dashboard/src/hooks/api/useBooths.ts`

- [ ] **Step 1: Adicionar a mutation**

Em `apps/dashboard/src/hooks/api/useBooths.ts`, adicionar ao final:

```ts
export const useUpdateBoothDevices = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      boothId,
      selectedCamera,
      selectedPrinter,
      maintenancePin,
    }: {
      boothId: string;
      selectedCamera?: string;
      selectedPrinter?: string;
      maintenancePin?: string;
    }) => {
      const { data } = await api.patch(`/tenant/booths/${boothId}/devices`, {
        selectedCamera,
        selectedPrinter,
        maintenancePin,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booths'] }),
  });
};
```

- [ ] **Step 2: Verificar build**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/hooks/api/useBooths.ts
git commit -m "feat(dashboard): add useUpdateBoothDevices mutation"
```

---

### Task 16: Dashboard — seção Dispositivos no drawer de cabines

**Files:**
- Modify: `apps/dashboard/src/pages/BoothsPage.tsx`

- [ ] **Step 1: Adicionar a seção de dispositivos e PIN ao drawer**

Substituir o conteúdo de `apps/dashboard/src/pages/BoothsPage.tsx` por:

```tsx
import React, { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, Drawer, Input, Select, Modal, Skeleton, EmptyState } from '../components/ui';
import { useBooths, useCreateBooth, useSetBoothEvent, useUpdateBoothDevices } from '../hooks/api/useBooths';
import { useEvents } from '../hooks/api/useEvents';
import { DeviceStatusEvent } from '@packages/shared';

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

export const BoothsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: booths, isLoading } = useBooths();
  const { data: events } = useEvents();
  const createBooth = useCreateBooth();
  const setBoothEvent = useSetBoothEvent();
  const updateDevices = useUpdateBoothDevices();

  const [drawerBooth, setDrawerBooth] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // Device section state
  const [devCamera, setDevCamera] = useState('');
  const [devPrinter, setDevPrinter] = useState('');
  const [devApplied, setDevApplied] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinSaved, setPinSaved] = useState(false);

  const openDrawer = (booth: any) => {
    setDrawerBooth(booth);
    setDevApplied(false);
    setPinSaved(false);
    setPinInput('');
    const deviceStatus = queryClient.getQueryData<DeviceStatusEvent>(['booth_devices', booth.id]);
    setDevCamera(deviceStatus?.selectedCamera ?? '');
    setDevPrinter(deviceStatus?.selectedPrinter ?? '');
  };

  const getDeviceStatus = (boothId: string) =>
    queryClient.getQueryData<DeviceStatusEvent>(['booth_devices', boothId]);

  const handleApplyDevices = () => {
    if (!drawerBooth) return;
    updateDevices.mutate(
      { boothId: drawerBooth.id, selectedCamera: devCamera || undefined, selectedPrinter: devPrinter || undefined },
      {
        onSuccess: () => {
          setDevApplied(true);
          setTimeout(() => setDevApplied(false), 2000);
        },
      },
    );
  };

  const handleSavePin = async () => {
    if (!drawerBooth || pinInput.length !== 4) return;
    const hash = await hashPin(pinInput);
    updateDevices.mutate(
      { boothId: drawerBooth.id, maintenancePin: hash },
      {
        onSuccess: () => {
          setPinSaved(true);
          setPinInput('');
          setTimeout(() => setPinSaved(false), 2000);
        },
      },
    );
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createBooth.mutate(
      { name: newName.trim() },
      { onSuccess: () => { setCreateOpen(false); setNewName(''); createBooth.reset(); } },
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
              <Button variant="secondary" size="sm" onClick={() => openDrawer(booth)}>
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
            <Button onClick={handleCreate} loading={createBooth.isPending} disabled={!newName.trim()}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Config Drawer */}
      {drawerBooth && (
        <Drawer open onClose={() => setDrawerBooth(null)} title="Configurar Cabine">
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
                  { onSuccess: () => {
                    setDrawerBooth({ ...drawerBooth, activeEventId: eventId, activeEvent: events?.find((ev) => ev.id === eventId) ?? null });
                  }},
                );
              }}
            />

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${drawerBooth.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-600">
                  {drawerBooth.isOnline ? 'Cabine online' : 'Cabine offline'}
                </span>
              </div>

              {/* ── Dispositivos ──────────────────────────────── */}
              {(() => {
                const deviceStatus = getDeviceStatus(drawerBooth.id);
                return (
                  <div className={`space-y-3 ${!drawerBooth.isOnline && deviceStatus ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Dispositivos</p>
                      {deviceStatus && (
                        <span className="text-xs text-gray-400">{timeAgo(deviceStatus.lastSeen)}</span>
                      )}
                    </div>

                    {!deviceStatus ? (
                      <p className="text-xs text-gray-400 italic">Aguardando dados da cabine...</p>
                    ) : (
                      <>
                        {!drawerBooth.isOnline && (
                          <p className="text-xs text-amber-600">Dados do último heartbeat</p>
                        )}
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-500">Câmera</label>
                          <select
                            value={devCamera}
                            onChange={(e) => setDevCamera(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="">Selecione</option>
                            {deviceStatus.cameras.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-500">Impressora</label>
                          <select
                            value={devPrinter}
                            onChange={(e) => setDevPrinter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                          >
                            <option value="">Selecione</option>
                            {deviceStatus.printers.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleApplyDevices}
                          loading={updateDevices.isPending}
                          disabled={!drawerBooth.isOnline || devApplied}
                        >
                          {devApplied ? 'Aplicado ✓' : 'Aplicar'}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── PIN de manutenção ─────────────────────────── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">PIN de manutenção</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:border-primary"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSavePin}
                    disabled={pinInput.length !== 4 || pinSaved}
                    loading={updateDevices.isPending}
                  >
                    {pinSaved ? 'Salvo ✓' : 'Salvar PIN'}
                  </Button>
                </div>
              </div>

              {/* ── Credenciais ───────────────────────────────── */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Credenciais para o Totem</p>
                <div>
                  <p className="text-xs text-gray-500 mb-1">ID da Cabine (VITE_BOOTH_ID)</p>
                  <code className="text-xs break-all bg-gray-50 p-1 block rounded border border-gray-200 select-all">
                    {drawerBooth.id}
                  </code>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Token (VITE_BOOTH_TOKEN)</p>
                  <code className="text-xs break-all bg-gray-50 p-1 block rounded border border-gray-200 select-all">
                    {drawerBooth.token}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verificar build completo**

```bash
cd apps/dashboard && npx tsc --noEmit 2>&1
```

Expected: sem erros.

- [ ] **Step 3: Rodar todos os testes do dashboard**

```bash
cd apps/dashboard && npx vitest run 2>&1
```

Expected: PASS em todos.

- [ ] **Step 4: Commit final**

```bash
git add apps/dashboard/src/pages/BoothsPage.tsx apps/dashboard/src/hooks/useDashboardSocket.ts
git commit -m "feat(dashboard): add device monitoring and configuration to booth drawer"
```

---

## Resumo dos arquivos

| Arquivo | Ação |
|---|---|
| `packages/shared/src/types.ts` | Modificado — `BoothConfigDto.devices` + 3 novos tipos |
| `apps/api/prisma/schema.prisma` | Modificado — 3 campos em `Booth` |
| `apps/api/prisma/migrations/20260415000000_.../migration.sql` | Criado |
| `apps/api/src/controllers/booths.controller.ts` | Modificado — `devices` em `getConfig` |
| `apps/api/src/controllers/booths.controller.spec.ts` | Criado |
| `apps/api/src/controllers/tenant.controller.ts` | Modificado — `PATCH /tenant/booths/:id/devices` |
| `apps/api/src/gateways/booth.gateway.ts` | Modificado — heartbeat, hardware_updated, force_hardware_update |
| `apps/totem/electron/preload.ts` | Modificado — `getPrinters` em `totemAPI` |
| `apps/totem/electron/main.ts` | Modificado — handler `get-printers` |
| `apps/totem/src/hooks/useDeviceConfig.ts` | Criado |
| `apps/totem/src/hooks/useDeviceConfig.test.ts` | Criado |
| `apps/totem/src/hooks/useBoothConfig.ts` | Modificado — sync de devices no boot |
| `apps/totem/src/hooks/useBoothMachine.ts` | Modificado — `socketRef`, `onForceHardwareUpdate`, `force_hardware_update` listener |
| `apps/totem/src/hooks/useDeviceHeartbeat.ts` | Criado |
| `apps/totem/src/screens/PinScreen.tsx` | Criado |
| `apps/totem/src/screens/PinScreen.test.tsx` | Criado |
| `apps/totem/src/screens/MaintenanceScreen.tsx` | Criado |
| `apps/totem/src/screens/IdleScreen.tsx` | Modificado — zona secreta |
| `apps/totem/src/screens/IdleScreen.test.tsx` | Modificado — testes da zona secreta |
| `apps/totem/src/App.tsx` | Modificado — orquestração completa |
| `apps/dashboard/src/hooks/useDashboardSocket.ts` | Modificado — `device_status` |
| `apps/dashboard/src/hooks/api/useBooths.ts` | Modificado — `useUpdateBoothDevices` |
| `apps/dashboard/src/pages/BoothsPage.tsx` | Modificado — seção dispositivos + PIN |
