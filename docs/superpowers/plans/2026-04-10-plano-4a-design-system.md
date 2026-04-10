# Plano 4A — Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared design system — Tailwind config, global CSS (Inter font + CSS variables), and 10 UI components for the dashboard.

**Architecture:** All components live in `apps/dashboard/src/components/ui/`. They are pure presentational React components with no API calls. The totem gets its own Tailwind config + CSS variables (no shared component library — totem UI is custom per screen). White-label color is applied via CSS custom property `--color-primary` using RGB channels so Tailwind opacity modifiers work.

**Tech Stack:** React, TypeScript, Tailwind CSS 3, Lucide React, Vitest + @testing-library/react, @fontsource/inter

---

## File Map

**New files:**
- `apps/dashboard/src/components/ui/Button.tsx`
- `apps/dashboard/src/components/ui/Button.test.tsx`
- `apps/dashboard/src/components/ui/Card.tsx`
- `apps/dashboard/src/components/ui/Badge.tsx`
- `apps/dashboard/src/components/ui/Badge.test.tsx`
- `apps/dashboard/src/components/ui/Input.tsx`
- `apps/dashboard/src/components/ui/Select.tsx`
- `apps/dashboard/src/components/ui/Modal.tsx`
- `apps/dashboard/src/components/ui/Modal.test.tsx`
- `apps/dashboard/src/components/ui/Drawer.tsx`
- `apps/dashboard/src/components/ui/Drawer.test.tsx`
- `apps/dashboard/src/components/ui/Skeleton.tsx`
- `apps/dashboard/src/components/ui/EmptyState.tsx`
- `apps/dashboard/src/components/ui/Avatar.tsx`
- `apps/dashboard/src/components/ui/index.ts`
- `apps/totem/tailwind.config.ts`

**Modified files:**
- `apps/dashboard/tailwind.config.ts` — add Inter font + primary color token
- `apps/dashboard/src/index.css` — Inter import + CSS variables + fix body styles
- `apps/totem/src/index.css` — CSS variables with RGB format

---

## Task 1: Install dependencies + update Tailwind configs

**Files:**
- Modify: `apps/dashboard/tailwind.config.ts`
- Create: `apps/totem/tailwind.config.ts`

- [ ] **Step 1: Install @fontsource/inter in dashboard and totem**

```bash
cd apps/dashboard && npm install @fontsource/inter
cd ../totem && npm install @fontsource/inter
cd ../..
```

- [ ] **Step 2: Replace `apps/dashboard/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb, 79 70 229) / <alpha-value>)',
          light: 'rgb(var(--color-primary-light-rgb, 238 242 255) / <alpha-value>)',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create `apps/totem/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb, 79 70 229) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Replace `apps/dashboard/src/index.css`**

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary-rgb: 79 70 229;
  --color-primary-light-rgb: 238 242 255;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: #f9fafb;
}
```

- [ ] **Step 5: Replace `apps/totem/src/index.css`**

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary-rgb: 79 70 229;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/tailwind.config.ts apps/dashboard/src/index.css
git add apps/totem/tailwind.config.ts apps/totem/src/index.css
git commit -m "feat(design-system): add Inter font, primary color CSS token, Tailwind config"
```

---

## Task 2: Button component

**Files:**
- Create: `apps/dashboard/src/components/ui/Button.tsx`
- Create: `apps/dashboard/src/components/ui/Button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/src/components/ui/Button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByText('Salvar')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Clique</Button>);
    fireEvent.click(screen.getByText('Clique'));
    expect(fn).toHaveBeenCalledOnce();
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled=true', () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const fn = vi.fn();
    render(<Button disabled onClick={fn}>Salvar</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Button.test.tsx
```
Expected: FAIL (Button not found)

- [ ] **Step 3: Create `apps/dashboard/src/components/ui/Button.tsx`**

```tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:opacity-90 active:opacity-80 shadow-sm',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 text-base rounded-xl gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => (
  <button
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    {...props}
  >
    {loading && <Loader2 size={size === 'sm' ? 12 : 16} className="animate-spin" />}
    {children}
  </button>
);
```

- [ ] **Step 4: Run — verify passes**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Button.test.tsx
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/ui/Button.tsx apps/dashboard/src/components/ui/Button.test.tsx
git commit -m "feat(design-system): add Button component"
```

---

## Task 3: Card, Badge components

**Files:**
- Create: `apps/dashboard/src/components/ui/Card.tsx`
- Create: `apps/dashboard/src/components/ui/Badge.tsx`
- Create: `apps/dashboard/src/components/ui/Badge.test.tsx`

- [ ] **Step 1: Write Badge failing test**

Create `apps/dashboard/src/components/ui/Badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders label', () => {
    render(<Badge variant="success">Online</Badge>);
    expect(screen.getByText('Online')).toBeTruthy();
  });

  it('applies success styles', () => {
    render(<Badge variant="success">Online</Badge>);
    const el = screen.getByText('Online');
    expect(el.className).toContain('green');
  });

  it('applies neutral styles', () => {
    render(<Badge variant="neutral">Offline</Badge>);
    const el = screen.getByText('Offline');
    expect(el.className).toContain('gray');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Badge.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/dashboard/src/components/ui/Badge.tsx`**

```tsx
import React from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'neutral' | 'primary';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-700',
  error:   'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  neutral: 'bg-gray-100 text-gray-600',
  primary: 'bg-primary-light text-primary',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
  >
    {children}
  </span>
);
```

- [ ] **Step 4: Create `apps/dashboard/src/components/ui/Card.tsx`**

```tsx
import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
}) => (
  <div
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${paddings[padding]} ${className}`}
  >
    {children}
  </div>
);
```

- [ ] **Step 5: Run Badge tests — verify pass**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Badge.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/components/ui/Card.tsx apps/dashboard/src/components/ui/Badge.tsx apps/dashboard/src/components/ui/Badge.test.tsx
git commit -m "feat(design-system): add Card and Badge components"
```

---

## Task 4: Input and Select components

**Files:**
- Create: `apps/dashboard/src/components/ui/Input.tsx`
- Create: `apps/dashboard/src/components/ui/Select.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/components/ui/Input.tsx`**

```tsx
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none transition-all
          ${error
            ? 'border-red-400 focus:ring-2 focus:ring-red-200'
            : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
          }
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
};
```

- [ ] **Step 2: Create `apps/dashboard/src/components/ui/Select.tsx`**

```tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...props
}) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={inputId}
          className={`w-full appearance-none px-3 py-2 pr-9 text-sm border rounded-xl outline-none transition-all bg-white
            ${error
              ? 'border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20'
            }
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/ui/Input.tsx apps/dashboard/src/components/ui/Select.tsx
git commit -m "feat(design-system): add Input and Select components"
```

---

## Task 5: Modal component

**Files:**
- Create: `apps/dashboard/src/components/ui/Modal.tsx`
- Create: `apps/dashboard/src/components/ui/Modal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/src/components/ui/Modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    expect(screen.getByText('Teste')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Teste">
        <p>Conteúdo</p>
      </Modal>
    );
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Modal.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/dashboard/src/components/ui/Modal.tsx`**

```tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

const maxWidths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidths[maxWidth]} bg-white rounded-2xl shadow-2xl p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run — verify passes**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Modal.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/ui/Modal.tsx apps/dashboard/src/components/ui/Modal.test.tsx
git commit -m "feat(design-system): add Modal component"
```

---

## Task 6: Drawer component

**Files:**
- Create: `apps/dashboard/src/components/ui/Drawer.tsx`
- Create: `apps/dashboard/src/components/ui/Drawer.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/dashboard/src/components/ui/Drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders children when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    expect(screen.getByText('Config')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Config">
        <p>Conteúdo</p>
      </Drawer>
    );
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Drawer.test.tsx
```
Expected: FAIL

- [ ] **Step 3: Create `apps/dashboard/src/components/ui/Drawer.tsx`**

```tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  children,
  width = 'w-full max-w-md',
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* On mobile (<md): bottom sheet; on md+: side drawer */}
      <div
        className={`
          bg-white shadow-2xl flex flex-col
          w-full h-[85dvh] rounded-t-2xl self-end
          md:h-full md:rounded-none md:rounded-l-2xl ${width}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run — verify passes**

```bash
cd apps/dashboard && npx vitest run src/components/ui/Drawer.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/components/ui/Drawer.tsx apps/dashboard/src/components/ui/Drawer.test.tsx
git commit -m "feat(design-system): add Drawer component (side on desktop, bottom sheet on mobile)"
```

---

## Task 7: Skeleton, EmptyState, Avatar components

**Files:**
- Create: `apps/dashboard/src/components/ui/Skeleton.tsx`
- Create: `apps/dashboard/src/components/ui/EmptyState.tsx`
- Create: `apps/dashboard/src/components/ui/Avatar.tsx`

- [ ] **Step 1: Create `apps/dashboard/src/components/ui/Skeleton.tsx`**

```tsx
import React from 'react';

export interface SkeletonProps {
  className?: string;
  rows?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rows = 1,
}) => {
  if (rows > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`h-4 bg-gray-100 rounded-lg animate-pulse ${i === rows - 1 ? 'w-3/4' : 'w-full'} ${className}`}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`bg-gray-100 rounded-lg animate-pulse ${className}`}
    />
  );
};
```

- [ ] **Step 2: Create `apps/dashboard/src/components/ui/EmptyState.tsx`**

```tsx
import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {icon && (
      <div className="mb-4 text-gray-300">{icon}</div>
    )}
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
    )}
    {action && (
      <Button onClick={action.onClick} size="sm">
        {action.label}
      </Button>
    )}
  </div>
);
```

- [ ] **Step 3: Create `apps/dashboard/src/components/ui/Avatar.tsx`**

```tsx
import React from 'react';

export interface AvatarProps {
  name?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = 'md',
  className = '',
}) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        className={`rounded-full object-cover ${sizes[size]} ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-primary text-white flex items-center justify-center font-semibold ${sizes[size]} ${className}`}
    >
      {initials(name)}
    </div>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/src/components/ui/Skeleton.tsx apps/dashboard/src/components/ui/EmptyState.tsx apps/dashboard/src/components/ui/Avatar.tsx
git commit -m "feat(design-system): add Skeleton, EmptyState, Avatar components"
```

---

## Task 8: Barrel export + run all tests

**Files:**
- Create: `apps/dashboard/src/components/ui/index.ts`

- [ ] **Step 1: Create `apps/dashboard/src/components/ui/index.ts`**

```ts
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { Drawer } from './Drawer';
export type { DrawerProps } from './Drawer';

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';
```

- [ ] **Step 2: Run all dashboard tests**

```bash
cd apps/dashboard && npx vitest run
```
Expected: all tests pass (including existing page tests)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/components/ui/index.ts
git commit -m "feat(design-system): export barrel for UI components"
```
