# Device Management — Design Spec

**Goal:** Permitir que o operador monitore e configure câmera e impressora de cada cabine remotamente pelo dashboard, com fallback local na cabine via tela de manutenção protegida por PIN.

**Architecture:** Híbrido offline-first. O totem guarda a config em localStorage e opera sem internet. A cada 30s envia um heartbeat com a lista de dispositivos detectados. O dashboard consome esse heartbeat via WebSocket e permite alterar a seleção remotamente; a API persiste e notifica o totem via `force_hardware_update`. Ao reconectar, o totem sempre obedece o servidor.

**Tech Stack:** React + Electron (totem), NestJS + Socket.IO (API), React + TanStack Query (dashboard), `crypto.subtle` SHA-256 para PIN, `navigator.mediaDevices` para câmeras, Electron IPC `webContents.getPrinters()` para impressoras.

---

## 1. Modelo de Dados

### Prisma — `Booth`
Três colunas novas, todas nullable (sem impacto em dados existentes):

```prisma
model Booth {
  // ...campos existentes...
  selectedCamera  String?
  selectedPrinter String?
  maintenancePin  String?  // SHA-256 hash do PIN de 4 dígitos
}
```

### Migração
```sql
ALTER TABLE "Booth" ADD COLUMN "selectedCamera"  TEXT;
ALTER TABLE "Booth" ADD COLUMN "selectedPrinter" TEXT;
ALTER TABLE "Booth" ADD COLUMN "maintenancePin"  TEXT;
```

---

## 2. Tipos Compartilhados (`packages/shared/src/types.ts`)

```ts
// Adicionado em BoothConfigDto
export interface BoothConfigDto {
  offlineMode: OfflineMode;
  offlineCredits: number;
  demoSessionsPerHour: number;
  cameraSound: boolean;
  branding: BoothBranding;
  devices: {
    selectedCamera: string | null;
    selectedPrinter: string | null;
    maintenancePin: string | null; // hash SHA-256
  };
}

// Novos tipos de evento WebSocket
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

---

## 3. API (`apps/api`)

### `schema.prisma`
Adicionar os três campos ao modelo `Booth` conforme seção 1.

### `GET /booths/:id/config`
Incluir `devices` no retorno:
```ts
devices: {
  selectedCamera: booth.selectedCamera,
  selectedPrinter: booth.selectedPrinter,
  maintenancePin: booth.maintenancePin,
}
```

### `PATCH /booths/:id/devices` (novo endpoint)
- Auth: JWT (dashboard)
- Body: `{ selectedCamera?: string; selectedPrinter?: string; maintenancePin?: string }`
- `maintenancePin` recebido já como SHA-256 (o dashboard faz o hash antes de enviar)
- Persiste no banco
- Emite `force_hardware_update` para o totem via `BoothGateway`

### `booth.gateway.ts`
Novo Map em memória:
```ts
private boothDevices = new Map<string, DeviceStatusEvent>();
```

Novos handlers:
- `device_heartbeat`: atualiza `boothDevices`, faz broadcast `device_status` para o dashboard (sem hit no banco)
- `hardware_updated`: persiste `selectedCamera`/`selectedPrinter` no banco + broadcast `device_status`

Novo método:
```ts
sendForceHardwareUpdate(boothId: string, payload: HardwareUpdateEvent): void
```

No `handleConnection`: ao conectar, compara config do banco com último heartbeat e emite `force_hardware_update` se divergir.

---

## 4. Totem (`apps/totem`)

### Electron IPC (`apps/totem/electron/`)

**`preload.ts`** — expõe API segura ao renderer:
```ts
contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  print: (options) => ipcRenderer.invoke('print', options),
});
```

**`main.ts`** — handlers IPC:
```ts
ipcMain.handle('get-printers', () => webContents.getPrinters());
ipcMain.handle('print', (_, options) => mainWindow.webContents.print(options));
```

### `useDeviceConfig` hook (novo)
Responsabilidade: ler e escrever config de dispositivos no localStorage.
```ts
interface DeviceConfig {
  selectedCamera: string | null;
  selectedPrinter: string | null;
  maintenancePinHash: string | null;
}
// Chave: 'booth_device_config'
```

### `useDeviceHeartbeat` hook (novo)
- Detecta câmeras via `navigator.mediaDevices.enumerateDevices()` (filtro `videoinput`)
- Detecta impressoras via `window.electronAPI.getPrinters()`
- Emite `device_heartbeat` pelo socket a cada 30s
- Emite imediatamente na primeira conexão (não espera 30s)

### Sincronização no boot
Em `useBoothConfig` (ou hook próprio), após receber a config da API:
- Compara `devices.selectedCamera` e `devices.selectedPrinter` com localStorage
- Se divergir, aplica o do servidor e atualiza localStorage

### Zona de toque secreta — `IdleScreen.tsx`
- `div` 100×100px, canto superior esquerdo, `opacity-0`, `position: absolute`
- Contador de toques com `setTimeout` de 3s para reset
- 5 toques → dispara `onSecretTap` callback
- `IdleScreen` recebe prop `onSecretTap: () => void`

### Tela de PIN — `PinScreen.tsx` (novo)
- Fundo com `backdrop-blur` sobre o idle
- Teclado numérico 3×4 (0–9, apagar, confirmar)
- 4 dígitos, sem exibir os números (bullets)
- Hash via `crypto.subtle.digest('SHA-256', ...)` comparado com `maintenancePinHash` do localStorage
- 3 tentativas erradas → fecha automaticamente
- Acerto → chama `onSuccess`

```ts
async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Tela de Manutenção — `MaintenanceScreen.tsx` (novo)
- Dropdown câmeras: lista detectada por `enumerateDevices`
- Dropdown impressoras: lista via `window.electronAPI.getPrinters()`
- Botão "Testar Câmera": preview ao vivo por 3s em modal
- Botão "Testar Impressora": dispara `window.electronAPI.print({ silent: true })`
- Botão "Salvar e Voltar":
  - Grava no localStorage via `useDeviceConfig`
  - Emite `hardware_updated` pelo socket: `{ boothId, selectedCamera, selectedPrinter, source: 'local' }`
  - Fecha a tela

### `App.tsx` — orquestração
```tsx
// Estado novo
const [showPin, setShowPin] = useState(false);
const [showMaintenance, setShowMaintenance] = useState(false);

// No IdleScreen:
<IdleScreen onSecretTap={() => setShowPin(true)} ... />

// Sobreposições (z-index alto, acima de tudo)
{showPin && (
  <PinScreen
    onSuccess={() => { setShowPin(false); setShowMaintenance(true); }}
    onClose={() => setShowPin(false)}
  />
)}
{showMaintenance && (
  <MaintenanceScreen onClose={() => setShowMaintenance(false)} />
)}
```

---

## 5. Dashboard (`apps/dashboard`)

### `useDashboardSocket.ts`
Ouvir novo evento `device_status`:
```ts
socket.on('device_status', (data: DeviceStatusEvent) => {
  queryClient.setQueryData(['booth_devices', data.boothId], data);
});
```

### `useBooths.ts`
Novo hook `useUpdateBoothDevices`:
```ts
// PATCH /booths/:id/devices
// Após sucesso: invalida query de booths, não precisa emitir socket (API faz isso)
```

### `BoothsPage.tsx` — seção "Dispositivos" no drawer
Adicionada abaixo do status de conexão, acima das credenciais:

```
── Dispositivos ──────────────────────────────
Atualizado há 12s                              ← timestamp do lastSeen

Câmera
[Logitech C920                          ▾]

Impressora
[DNP RX1                                ▾]

[Aplicar]

── PIN de manutenção ─────────────────────────
[____]  [Salvar PIN]
```

**Estados:**
- Cabine offline → seção opaca, label "Dados do último heartbeat"
- Sem heartbeat → "Aguardando dados da cabine..."
- Aplicando → botão em loading
- Aplicado → "Aplicado ✓" por 2s

**PIN:** campo numérico `maxLength=4`, ao clicar "Salvar PIN" faz hash SHA-256 no browser antes de enviar para `PATCH /booths/:id/devices`.

---

## 6. Fluxos Completos

### Operadora muda câmera localmente (sem internet)
```
5 toques → PIN → Manutenção → seleciona câmera → Salvar
→ localStorage atualizado
→ socket emite hardware_updated (falha silenciosamente se offline)
→ totem usa nova câmera imediatamente
→ ao reconectar: heartbeat imediato → API compara → se dashboard não mudou nada, mantém
```

### Operador muda câmera pelo dashboard (online)
```
Dashboard: seleciona câmera → Aplicar
→ PATCH /booths/:id/devices
→ API persiste no banco
→ API emite force_hardware_update para o totem
→ Totem aplica + atualiza localStorage + confirma com hardware_updated
→ Dashboard recebe device_status atualizado, mostra "Aplicado ✓"
```

### Totem reinicia sem internet
```
Boot → lê localStorage → usa selectedCamera e selectedPrinter salvos
→ tenta conectar socket → falha → opera normalmente com config local
→ ao reconectar: heartbeat imediato → sync com servidor
```

---

## 7. Arquivos Criados / Modificados

| Arquivo | Ação |
|---|---|
| `apps/api/prisma/schema.prisma` | Modificar — 3 campos novos em Booth |
| `apps/api/prisma/migrations/..._add_device_fields_to_booth/` | Criar |
| `packages/shared/src/types.ts` | Modificar — BoothConfigDto + 3 novos tipos |
| `apps/api/src/controllers/booths.controller.ts` | Modificar — devices em getConfig + novo PATCH endpoint |
| `apps/api/src/gateways/booth.gateway.ts` | Modificar — handlers heartbeat/hardware_updated + sendForceHardwareUpdate |
| `apps/totem/electron/preload.ts` | Criar |
| `apps/totem/electron/main.ts` | Criar ou modificar |
| `apps/totem/src/hooks/useDeviceConfig.ts` | Criar |
| `apps/totem/src/hooks/useDeviceHeartbeat.ts` | Criar |
| `apps/totem/src/screens/PinScreen.tsx` | Criar |
| `apps/totem/src/screens/MaintenanceScreen.tsx` | Criar |
| `apps/totem/src/screens/IdleScreen.tsx` | Modificar — zona secreta + prop onSecretTap |
| `apps/totem/src/App.tsx` | Modificar — orquestrar Pin + Maintenance |
| `apps/dashboard/src/hooks/useDashboardSocket.ts` | Modificar — ouvir device_status |
| `apps/dashboard/src/hooks/api/useBooths.ts` | Modificar — useUpdateBoothDevices |
| `apps/dashboard/src/pages/BoothsPage.tsx` | Modificar — seção Dispositivos + PIN no drawer |
