# Plano 4D — Totem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all totem screens with the new design system — white-label theming from booth config, redesigned IDLE/FrameSelection/Payment/Camera/Processing/Delivery screens, and digital upsell flow in DeliveryScreen.

**Architecture:** Each state of `BoothState` maps to a dedicated screen component under `apps/totem/src/screens/`. `App.tsx` reads branding from `useBoothConfig` and applies CSS variables. The existing `CameraEngine`, `CountdownOverlay`, and `useBoothMachine` are reused unchanged. `useBoothEvent` is updated to consume the new `BoothEventResponseDto` shape (with `digitalPrice`, `backgroundUrl`, `maxTemplates`).

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React, Vite, Vitest + @testing-library/react, Electron IPC (`window.electronAPI`)

---

## File Map

**New:**
- `apps/totem/src/screens/IdleScreen.tsx`
- `apps/totem/src/screens/FrameSelectionScreen.tsx`
- `apps/totem/src/screens/PaymentScreen.tsx`
- `apps/totem/src/screens/ProcessingScreen.tsx`
- `apps/totem/src/screens/DeliveryScreen.tsx`

**Modified:**
- `apps/totem/src/hooks/useBoothEvent.ts` — return new fields (digitalPrice, backgroundUrl, maxTemplates); templates shape updated
- `apps/totem/src/App.tsx` — apply CSS vars from branding, render new screen components, pass digitalPrice to DeliveryScreen
- `apps/totem/src/components/DeliveryScreen.tsx` — replaced by `screens/DeliveryScreen.tsx` (kept as re-export for backward compat with existing tests)
- `apps/totem/src/components/TemplateSelector.tsx` — replaced by `screens/FrameSelectionScreen.tsx` (same)

---

## Task 1: Update useBoothEvent hook

**Files:**
- Modify: `apps/totem/src/hooks/useBoothEvent.ts`
- Modify: `apps/totem/src/hooks/useBoothEvent.test.ts`

- [ ] **Step 1: Write failing test for updated hook shape**

Replace `apps/totem/src/hooks/useBoothEvent.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useBoothEvent } from './useBoothEvent';

vi.mock('axios');

describe('useBoothEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns event with digitalPrice, backgroundUrl, maxTemplates', async () => {
    (axios.get as any).mockResolvedValueOnce({
      data: {
        event: {
          id: 'ev-1', name: 'Wedding', price: 30, photoCount: 4,
          digitalPrice: 5, backgroundUrl: 'https://s3/bg.jpg', maxTemplates: 3,
        },
        templates: [
          { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', order: 0 },
        ],
      },
    });

    const { result } = renderHook(() => useBoothEvent('b-1', 'tok'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.event?.digitalPrice).toBe(5);
    expect(result.current.event?.backgroundUrl).toBe('https://s3/bg.jpg');
    expect(result.current.event?.maxTemplates).toBe(3);
    expect(result.current.templates[0].order).toBe(0);
  });

  it('sets error when request fails', async () => {
    (axios.get as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBoothEvent('b-1', 'bad-token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/hooks/useBoothEvent.test.ts
```
Expected: FAIL (event shape doesn't include digitalPrice/backgroundUrl/maxTemplates)

- [ ] **Step 3: Replace `apps/totem/src/hooks/useBoothEvent.ts`**

```ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { BoothEventResponseDto } from '@packages/shared';

type BoothEvent = BoothEventResponseDto['event'];
type BoothTemplate = BoothEventResponseDto['templates'][number];

export function useBoothEvent(boothId: string, token: string) {
  const [event, setEvent] = useState<BoothEvent | null>(null);
  const [templates, setTemplates] = useState<BoothTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    axios
      .get<BoothEventResponseDto>(`${apiUrl}/booths/${boothId}/event`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => {
        setEvent(res.data.event);
        setTemplates(res.data.templates);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError('Failed to load event');
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [boothId, token]);

  return { event, templates, isLoading, error };
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/hooks/useBoothEvent.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/hooks/useBoothEvent.ts apps/totem/src/hooks/useBoothEvent.test.ts
git commit -m "feat(totem): useBoothEvent returns digitalPrice, backgroundUrl, maxTemplates, ordered templates"
```

---

## Task 2: IdleScreen

**Files:**
- Create: `apps/totem/src/screens/IdleScreen.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/screens/IdleScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IdleScreen } from './IdleScreen';

describe('IdleScreen', () => {
  it('renders brand name', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('MyBooth')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });

  it('shows loading message when eventLoading', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading
        hasEvent={false}
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('Carregando evento...')).toBeTruthy();
  });

  it('shows "not configured" when no event and not loading', () => {
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent={false}
        onTap={vi.fn()}
      />
    );
    expect(screen.getByText('Cabine não configurada')).toBeTruthy();
  });

  it('calls onTap when tapped and has event', () => {
    const onTap = vi.fn();
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent
        onTap={onTap}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('does NOT call onTap when has no event', () => {
    const onTap = vi.fn();
    render(
      <IdleScreen
        brandName="MyBooth"
        logoUrl={null}
        backgroundUrl={null}
        eventLoading={false}
        hasEvent={false}
        onTap={onTap}
      />
    );
    // No button rendered when no event
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/screens/IdleScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/totem/src/screens/IdleScreen.tsx`**

```tsx
import React from 'react';

interface IdleScreenProps {
  brandName: string | null;
  logoUrl: string | null;
  backgroundUrl: string | null;
  eventLoading: boolean;
  hasEvent: boolean;
  onTap: () => void;
}

export const IdleScreen: React.FC<IdleScreenProps> = ({
  brandName,
  logoUrl,
  backgroundUrl,
  eventLoading,
  hasEvent,
  onTap,
}) => {
  const canTap = !eventLoading && hasEvent;

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        backgroundColor: backgroundUrl ? 'transparent' : '#0f0f0f',
      }}
    >
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
          <img
            src={logoUrl}
            alt="logo"
            className="h-24 object-contain drop-shadow-lg"
          />
        )}

        <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-lg">
          {brandName ?? 'PhotoBooth'}
        </h1>

        {eventLoading ? (
          <p className="text-2xl text-white/60 font-medium">Carregando evento...</p>
        ) : !hasEvent ? (
          <p className="text-2xl text-white/40 font-medium">Cabine não configurada</p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/screens/IdleScreen.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/IdleScreen.tsx apps/totem/src/screens/IdleScreen.test.tsx
git commit -m "feat(totem): IdleScreen with white-label branding, background image, tap-to-start"
```

---

## Task 3: FrameSelectionScreen

**Files:**
- Create: `apps/totem/src/screens/FrameSelectionScreen.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/screens/FrameSelectionScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameSelectionScreen } from './FrameSelectionScreen';

const TEMPLATES = [
  { id: 't-1', name: 'Floral', overlayUrl: 'https://s3/t1.png', order: 0 },
  { id: 't-2', name: 'Gold',   overlayUrl: 'https://s3/t2.png', order: 1 },
];

describe('FrameSelectionScreen', () => {
  it('renders template cards', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Floral')).toBeTruthy();
    expect(screen.getByText('Gold')).toBeTruthy();
  });

  it('Continuar button is disabled when nothing selected', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Continuar').closest('button')).toBeDisabled();
  });

  it('Continuar button is enabled when a template is selected', () => {
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId="t-1"
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    expect(screen.getByText('Continuar').closest('button')).not.toBeDisabled();
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId=""
        onSelect={onSelect}
        onConfirm={vi.fn()}
        videoRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByText('Floral'));
    expect(onSelect).toHaveBeenCalledWith('t-1');
  });

  it('calls onConfirm when Continuar is clicked with selection', () => {
    const onConfirm = vi.fn();
    render(
      <FrameSelectionScreen
        templates={TEMPLATES}
        selectedId="t-2"
        onSelect={vi.fn()}
        onConfirm={onConfirm}
        videoRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByText('Continuar'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/screens/FrameSelectionScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/totem/src/screens/FrameSelectionScreen.tsx`**

```tsx
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  overlayUrl: string;
  order: number;
}

interface FrameSelectionScreenProps {
  templates: Template[];
  selectedId: string;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export const FrameSelectionScreen: React.FC<FrameSelectionScreenProps> = ({
  templates,
  selectedId,
  onSelect,
  onConfirm,
  videoRef,
}) => {
  // Portrait: 2 cols. Landscape: 3 cols.
  const gridClass = 'grid grid-cols-2 md:grid-cols-3 gap-4';

  return (
    <div className="w-full h-full flex flex-col bg-gray-950">
      {/* Live camera feed as background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-20 scale-x-[-1]"
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-3xl font-bold text-white">Escolha sua moldura</h2>
          <p className="text-white/50 text-lg mt-1">Toque para selecionar</p>
        </div>

        {/* Templates grid */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className={gridClass}>
            {templates.map((t) => {
              const isSelected = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden border-4 transition-all focus:outline-none
                    ${isSelected
                      ? 'border-primary scale-[1.02] shadow-2xl shadow-primary/40'
                      : 'border-white/10 hover:border-white/30'
                    }`}
                >
                  {/* Live camera overlay preview */}
                  <div className="absolute inset-0 bg-gray-800" />
                  <img
                    src={t.overlayUrl}
                    alt={t.name}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-primary">
                      <CheckCircle2 size={28} fill="white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                    <p className="text-white text-sm font-semibold text-center truncate">{t.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-10 pt-4">
          <button
            onClick={onConfirm}
            disabled={!selectedId}
            className={`w-full py-5 rounded-2xl text-xl font-bold transition-all
              ${selectedId
                ? 'bg-primary text-white shadow-lg shadow-primary/40 hover:opacity-90 active:scale-[0.98]'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/screens/FrameSelectionScreen.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/FrameSelectionScreen.tsx apps/totem/src/screens/FrameSelectionScreen.test.tsx
git commit -m "feat(totem): FrameSelectionScreen with grid, camera background, continue button"
```

---

## Task 4: PaymentScreen

**Files:**
- Create: `apps/totem/src/screens/PaymentScreen.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/screens/PaymentScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentScreen } from './PaymentScreen';

const PAYMENT = {
  paymentId: 'pay-1',
  qrCode: 'pix-code-string',
  qrCodeBase64: 'aGVsbG8=',
  expiresIn: 120,
};

describe('PaymentScreen', () => {
  it('renders amount prominently', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    expect(screen.getByText('R$ 30,00')).toBeTruthy();
  });

  it('shows pix code for copy', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    expect(screen.getByText('pix-code-string')).toBeTruthy();
  });

  it('shows QR code image', () => {
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toContain('base64');
  });

  it('calls onCancel when Cancelar is clicked', () => {
    const onCancel = vi.fn();
    render(<PaymentScreen amount={30} payment={PAYMENT} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows loading spinner when payment is null', () => {
    render(<PaymentScreen amount={30} payment={null} onCancel={vi.fn()} />);
    expect(screen.getByText('Gerando QR Code...')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/screens/PaymentScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/totem/src/screens/PaymentScreen.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { PixPaymentResponse } from '@packages/shared';

interface PaymentScreenProps {
  amount: number;
  payment: PixPaymentResponse | null;
  onCancel: () => void;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CircularTimer({ expiresIn }: { expiresIn: number }) {
  const [remaining, setRemaining] = useState(expiresIn);

  useEffect(() => {
    setRemaining(expiresIn);
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  const pct = remaining / expiresIn;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="absolute -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke="rgb(var(--color-primary-rgb, 79 70 229))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="text-white text-xs font-mono font-bold">
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}

export const PaymentScreen: React.FC<PaymentScreenProps> = ({
  amount,
  payment,
  onCancel,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!payment?.qrCode) return;
    navigator.clipboard.writeText(payment.qrCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 px-8 gap-8 text-center">
      {/* Amount */}
      <div>
        <p className="text-white/50 text-lg font-medium">Pague com PIX</p>
        <p className="text-6xl font-black text-white mt-2">{formatCurrency(amount)}</p>
      </div>

      {payment ? (
        <>
          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl shadow-2xl">
            <img
              src={`data:image/png;base64,${payment.qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-56 h-56 md:w-64 md:h-64"
            />
          </div>

          {/* Timer */}
          <CircularTimer expiresIn={payment.expiresIn} />

          {/* Pix code — tap to copy */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 transition-colors max-w-sm w-full"
          >
            <span className="flex-1 text-white/50 text-xs font-mono truncate text-left">
              {payment.qrCode}
            </span>
            <span className="text-white/70 shrink-0">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </span>
          </button>
          {copied && <p className="text-green-400 text-sm -mt-4">Copiado!</p>}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
          <p className="text-white/50 text-lg">Gerando QR Code...</p>
        </div>
      )}

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="text-white/30 hover:text-white/60 text-base font-medium transition-colors py-2 px-6"
      >
        Cancelar
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/screens/PaymentScreen.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/PaymentScreen.tsx apps/totem/src/screens/PaymentScreen.test.tsx
git commit -m "feat(totem): PaymentScreen with QR code, circular countdown timer, tap-to-copy"
```

---

## Task 5: ProcessingScreen

**Files:**
- Create: `apps/totem/src/screens/ProcessingScreen.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/screens/ProcessingScreen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingScreen } from './ProcessingScreen';

describe('ProcessingScreen', () => {
  it('shows single-photo message for photoCount 1', () => {
    render(<ProcessingScreen photoCount={1} />);
    expect(screen.getByText('Preparando sua foto...')).toBeTruthy();
  });

  it('shows strip message for photoCount 4', () => {
    render(<ProcessingScreen photoCount={4} />);
    expect(screen.getByText('Montando sua tira de fotos...')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/screens/ProcessingScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/totem/src/screens/ProcessingScreen.tsx`**

```tsx
import React from 'react';

interface ProcessingScreenProps {
  photoCount: number;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ photoCount }) => {
  const message = photoCount === 1
    ? 'Preparando sua foto...'
    : 'Montando sua tira de fotos...';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8">
      {/* Elegant spinner */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
          style={{ animationDuration: '0.8s' }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent border-t-primary/40 animate-spin"
          style={{ animationDuration: '1.4s', animationDirection: 'reverse' }}
        />
      </div>

      <p className="text-white text-2xl font-semibold tracking-wide">{message}</p>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/screens/ProcessingScreen.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/ProcessingScreen.tsx apps/totem/src/screens/ProcessingScreen.test.tsx
git commit -m "feat(totem): ProcessingScreen with nested spinner and dynamic message"
```

---

## Task 6: DeliveryScreen (print-first + digital upsell)

**Files:**
- Create: `apps/totem/src/screens/DeliveryScreen.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/screens/DeliveryScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DeliveryScreen } from './DeliveryScreen';

// Mock electronAPI
beforeEach(() => {
  (window as any).electronAPI = { printPhoto: vi.fn() };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DeliveryScreen — free digital', () => {
  it('shows printing animation initially', () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText('Imprimindo sua foto...')).toBeTruthy();
  });

  it('fires printPhoto IPC on mount', () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    expect((window as any).electronAPI.printPhoto).toHaveBeenCalledWith('https://s3/photo.jpg');
  });

  it('shows free download QR after print animation completes', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={null}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    vi.advanceTimersByTime(2500);
    await waitFor(() => {
      expect(screen.getByText('Escaneie para baixar sua foto digital')).toBeTruthy();
    });
  });
});

describe('DeliveryScreen — paid digital upsell', () => {
  it('shows upsell offer after print animation', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={5}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    vi.advanceTimersByTime(2500);
    await waitFor(() => {
      expect(screen.getByText('Quer sua foto no celular?')).toBeTruthy();
    });
  });

  it('shows "Não, obrigado" button on upsell screen', async () => {
    render(
      <DeliveryScreen
        sessionId="s-1"
        photoUrl="https://s3/photo.jpg"
        digitalPrice={5}
        brandName="MyBooth"
        onDone={vi.fn()}
      />
    );
    vi.advanceTimersByTime(2500);
    await waitFor(() => {
      expect(screen.getByText('Não, obrigado')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/screens/DeliveryScreen.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/totem/src/screens/DeliveryScreen.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PixPaymentResponse } from '@packages/shared';
import { Printer } from 'lucide-react';

interface DeliveryScreenProps {
  sessionId: string;
  photoUrl: string;
  digitalPrice: number | null;
  brandName: string | null;
  onDone: () => void;
}

type Phase = 'printing' | 'upsell' | 'upsell-qr' | 'free-download';

const DOWNLOAD_URL_BASE = import.meta.env.VITE_APP_URL ?? 'http://localhost:5173';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const COUNTDOWN_SECONDS = 15;

export const DeliveryScreen: React.FC<DeliveryScreenProps> = ({
  sessionId,
  photoUrl,
  digitalPrice,
  brandName,
  onDone,
}) => {
  const [phase, setPhase] = useState<Phase>('printing');
  const [digitalPayment, setDigitalPayment] = useState<PixPaymentResponse | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // 1. Fire print IPC immediately
  useEffect(() => {
    try {
      (window as any).electronAPI?.printPhoto(photoUrl);
    } catch {
      // Electron API not available in dev/test — ignore
    }
  }, [photoUrl]);

  // 2. After 2.5s animation → move to next phase
  useEffect(() => {
    const timer = setTimeout(() => {
      if (digitalPrice && digitalPrice > 0) {
        setPhase('upsell');
      } else {
        setPhase('free-download');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [digitalPrice]);

  // 3. Countdown for free-download phase
  useEffect(() => {
    if (phase !== 'free-download') return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { onDone(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, onDone]);

  // 4. Request upsell PIX
  const requestUpsell = useCallback(async () => {
    try {
      const res = await axios.post<PixPaymentResponse>(`${API_URL}/payments/digital/${sessionId}`);
      setDigitalPayment(res.data);
      setPhase('upsell-qr');
    } catch {
      // Failed to create digital payment — skip upsell
      onDone();
    }
  }, [sessionId, onDone]);

  // 5. Poll payment status when in upsell-qr phase
  useEffect(() => {
    if (phase !== 'upsell-qr' || !digitalPayment) return;
    const poll = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/payments/${digitalPayment.paymentId}`);
        if (res.data.status === 'APPROVED') {
          clearInterval(poll);
          // Show confirmed state for 5s then done
          setTimeout(onDone, 5000);
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [phase, digitalPayment, onDone]);

  const downloadUrl = `${DOWNLOAD_URL_BASE}/p/${sessionId}`;

  // ── PHASE: printing ────────────────────────────────────────────────────
  if (phase === 'printing') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="p-6 bg-white/5 rounded-3xl">
            <Printer size={64} className="text-white" />
          </div>
          <p className="text-white text-2xl font-semibold">Imprimindo sua foto...</p>
        </div>
      </div>
    );
  }

  // ── PHASE: free-download ───────────────────────────────────────────────
  if (phase === 'free-download') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
        <h2 className="text-4xl font-bold text-white">Sua foto está pronta!</h2>

        {/* QR Code pointing to /p/:sessionId */}
        <div className="bg-white p-4 rounded-2xl shadow-2xl">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`}
            alt="QR Code download"
            className="w-48 h-48"
          />
        </div>

        <div>
          <p className="text-white/70 text-xl">Escaneie para baixar sua foto digital</p>
          {brandName && <p className="text-white/40 text-base mt-2">{brandName}</p>}
        </div>

        <p className="text-white/30 text-base">
          Voltando ao início em {countdown}s...
        </p>
      </div>
    );
  }

  // ── PHASE: upsell ──────────────────────────────────────────────────────
  if (phase === 'upsell') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
        <h2 className="text-4xl font-bold text-white">Quer sua foto no celular?</h2>
        <p className="text-7xl font-black text-white">
          {digitalPrice!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
        <p className="text-white/60 text-xl">Pague com PIX e receba no celular</p>

        <button
          onClick={requestUpsell}
          className="bg-primary text-white text-xl font-bold px-12 py-5 rounded-2xl shadow-lg shadow-primary/40 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Quero minha foto digital
        </button>

        <button
          onClick={onDone}
          className="text-white/30 hover:text-white/60 text-base font-medium transition-colors py-2 px-6"
        >
          Não, obrigado
        </button>
      </div>
    );
  }

  // ── PHASE: upsell-qr ──────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 gap-8 px-8 text-center">
      <h2 className="text-3xl font-bold text-white">Escaneie para pagar</h2>

      {digitalPayment ? (
        <div className="bg-white p-4 rounded-2xl shadow-2xl">
          <img
            src={`data:image/png;base64,${digitalPayment.qrCodeBase64}`}
            alt="QR Code PIX Digital"
            className="w-56 h-56"
          />
        </div>
      ) : (
        <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
      )}

      <p className="text-white/50 text-base">Aguardando pagamento...</p>

      <button
        onClick={onDone}
        className="text-white/30 hover:text-white/60 text-sm font-medium transition-colors py-2 px-6"
      >
        Cancelar
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/screens/DeliveryScreen.test.tsx
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/screens/DeliveryScreen.tsx apps/totem/src/screens/DeliveryScreen.test.tsx
git commit -m "feat(totem): DeliveryScreen — print-first IPC, free download QR, paid upsell flow"
```

---

## Task 7: Update App.tsx — white-label theming + new screens

**Files:**
- Modify: `apps/totem/src/App.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/totem/src/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useBoothConfig', () => ({
  useBoothConfig: () => ({
    config: { branding: { brandName: 'TestBooth', logoUrl: null, primaryColor: '#1d4ed8' }, offlineMode: 'BLOCK', offlineCredits: 0, demoSessionsPerHour: 3, cameraSound: true },
  }),
}));

vi.mock('./hooks/useBoothEvent', () => ({
  useBoothEvent: () => ({
    event: { id: 'ev-1', name: 'Wedding', price: 30, photoCount: 1, digitalPrice: null, backgroundUrl: null, maxTemplates: 3 },
    templates: [],
    isLoading: false,
  }),
}));

vi.mock('./hooks/useBoothMachine', () => ({
  useBoothMachine: () => ({
    state: 'IDLE',
    currentPayment: null,
    sessionId: null,
    startPayment: vi.fn(),
    completeSession: vi.fn(),
  }),
}));

vi.mock('./hooks/useWebcam', () => ({
  useWebcam: () => ({ videoRef: { current: null }, error: null, isLoading: false }),
}));

describe('App — IDLE state', () => {
  it('renders brand name in idle screen', () => {
    render(<App />);
    expect(screen.getByText('TestBooth')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/totem && npx vitest run src/App.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Replace `apps/totem/src/App.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { BoothState } from '@packages/shared';
import { useWebcam } from './hooks/useWebcam';
import { useBoothConfig } from './hooks/useBoothConfig';
import { useBoothEvent } from './hooks/useBoothEvent';
import { useBoothMachine } from './hooks/useBoothMachine';
import { CameraEngine } from './components/CameraEngine';
import { IdleScreen } from './screens/IdleScreen';
import { FrameSelectionScreen } from './screens/FrameSelectionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';

const BOOTH_ID    = import.meta.env.VITE_BOOTH_ID    ?? '';
const BOOTH_TOKEN = import.meta.env.VITE_BOOTH_TOKEN ?? '';

/** Convert hex color to "r g b" RGB triplet string for CSS custom property */
function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export default function App() {
  const { videoRef } = useWebcam();
  const { config }   = useBoothConfig(BOOTH_ID, BOOTH_TOKEN);
  const { event, templates, isLoading: eventLoading } = useBoothEvent(BOOTH_ID, BOOTH_TOKEN);
  const machine = useBoothMachine(BOOTH_ID, BOOTH_TOKEN, config);

  const [isSelectingFrame, setIsSelectingFrame]   = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Apply white-label CSS variables whenever branding changes
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

  // Reset frame selection when returning to IDLE
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
          hasEvent={!!event && templates.length > 0}
          onTap={handleIdleTap}
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
          photoCount={(event?.photoCount ?? 1) as 1 | 2 | 4}
          cameraSound={config?.cameraSound ?? true}
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
          photoUrl={''}
          digitalPrice={event?.digitalPrice ?? null}
          brandName={config?.branding.brandName ?? null}
          onDone={() => machine.startPayment('', '', 0)}
        />
      )}

    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd apps/totem && npx vitest run src/App.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/totem/src/App.tsx apps/totem/src/App.test.tsx
git commit -m "feat(totem): App.tsx uses new screen components, applies white-label CSS vars"
```

---

## Task 8: Run all totem tests

- [ ] **Step 1: Run the full totem test suite**

```bash
cd apps/totem && npx vitest run && cd ../..
```
Expected: all tests pass (CameraEngine, CountdownOverlay, TemplateSelector, useBoothConfig, useBoothEvent, useBoothMachine, IdleScreen, FrameSelectionScreen, PaymentScreen, ProcessingScreen, DeliveryScreen, App)

- [ ] **Step 2: Commit final tag**

```bash
git add .
git commit -m "feat(totem): all screens complete — Plan 4D done"
```
