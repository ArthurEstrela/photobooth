# Booth Pairing Design

## Goal

Replace manual `VITE_BOOTH_ID` / `VITE_BOOTH_TOKEN` `.env` configuration with a guided pairing flow: the dashboard generates a short-lived 6-char code (+ QR), the totem scans or types it, and the credentials are persisted permanently via `electron-store`.

## Architecture

Four layers interact:

1. **API** — generates/validates pairing codes, issues a scoped booth JWT, handles unpair
2. **Dashboard** — UI to generate the code + QR inside the existing booth drawer
3. **Totem / Electron main** — `electron-store` for credential persistence, IPC bridge
4. **Totem / React** — `PairingScreen` shown on first boot (or after unpair); `MaintenanceScreen` gets unpair button

---

## Section 1 — Data Model

Add three fields to `Booth` in `schema.prisma`:

```prisma
pairingCode          String?   @unique
pairingCodeExpiresAt DateTime?
pairedAt             DateTime?
```

- `pairingCode` — the 6-char code currently active (null when not in pairing mode)
- `pairingCodeExpiresAt` — UTC timestamp; pair endpoint rejects codes past this
- `pairedAt` — set on successful pair, cleared on unpair; dashboard uses this to show "pareado" vs "não pareado"

---

## Section 2 — Pairing Code Format

The code is generated server-side using this charset (ambiguous characters removed):

```
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```

Removed: `0` (zero), `O` (letter O), `1` (one), `I` (letter I), `L` (letter L).

Six characters from this 31-char set gives ~887 million combinations. Combined with 30-minute expiry and one-time-use deletion, brute force is not a practical attack.

---

## Section 3 — API Endpoints

### 3.1 `POST /booths/:id/pairing-code`

**Auth:** `JwtAuthGuard` (tenant JWT — dashboard operator)

**Behavior:**
- Validates the booth belongs to the authenticated tenant
- Generates a 6-char code from the unambiguous charset
- Stores code + `expiresAt = now + 30 minutes` on the booth record
- Returns:

```json
{ "code": "AB3K7X", "expiresAt": "2026-04-26T14:30:00.000Z" }
```

The QR displayed in the dashboard encodes just the code string (`"AB3K7X"`).

### 3.2 `POST /booths/pair`

**Auth:** None (public)

**Body:** `{ "code": "AB3K7X" }`

**Behavior:**
1. Finds booth where `pairingCode = code AND pairingCodeExpiresAt > now`
2. If not found or expired: `404 Not Found`
3. Clears `pairingCode` and `pairingCodeExpiresAt` (one-time use)
4. Sets `pairedAt = now`
5. Signs and returns a booth JWT (see Section 4)

**Response:**
```json
{ "boothId": "uuid", "token": "<jwt>" }
```

### 3.3 `POST /booths/unpair`

**Auth:** `BoothJwtGuard` (booth JWT)

**Behavior:**
1. Extracts `boothId` from JWT payload
2. Sets `pairedAt = null` on the booth
3. Emits `booth_unpaired` WebSocket event to the tenant's dashboard room
4. Returns `200 OK`

---

## Section 4 — Booth JWT

The pair endpoint issues a **long-lived JWT** (no expiry) signed with `JWT_SECRET`:

```json
{
  "sub": "<boothId>",
  "tenantId": "<tenantId>",
  "role": "booth"
}
```

This token is stored in `electron-store` and used as the `Authorization: Bearer` header for all booth API calls.

A new `BoothJwtGuard` (`apps/api/src/guards/booth-jwt.guard.ts`) validates:
- Signature valid (same `JWT_SECRET`)
- `payload.role === 'booth'`
- When an `:id` route param is present, `payload.sub === params.id` (guard reads `ExecutionContext` to get the request params)

On success the guard attaches `{ sub: boothId, tenantId, role: 'booth' }` as `request.user` so controllers can read it via `@Request() req`.

**All existing `BoothsController` endpoints** (`GET /booths/:id/config`, `GET /booths/:id/event`) switch from raw `WHERE id = :id AND token = :rawToken` to `BoothJwtGuard`. The `booth.token` field in the DB is no longer sent to the totem and is kept only as an internal identifier (can be phased out in future).

---

## Section 5 — electron-store (Totem)

`electron-store` is installed as a dependency in `apps/totem`.

**Schema:**
```typescript
interface BoothStore {
  boothId: string;
  boothToken: string; // the booth JWT
}
```

**IPC bridge** — `electron/main.ts` registers handlers:
- `ipcMain.handle('store-get-credentials')` → returns `{ boothId, boothToken }` or `null`
- `ipcMain.handle('store-set-credentials', { boothId, boothToken })` → persists to store
- `ipcMain.handle('store-clear-credentials')` → deletes from store

**Preload** — `electron/preload.ts` exposes on `totemAPI`:
```typescript
getCredentials: () => Promise<{ boothId: string; boothToken: string } | null>
setCredentials: (data: { boothId: string; boothToken: string }) => Promise<void>
clearCredentials: () => Promise<void>
```

**`useBoothCredentials` hook** (`apps/totem/src/hooks/useBoothCredentials.ts`):
```typescript
export function useBoothCredentials() {
  // Reads from electron-store via totemAPI on mount
  // Returns { boothId, boothToken, isLoading, setCredentials, clearCredentials }
}
```

---

## Section 6 — PairingScreen (Totem)

`apps/totem/src/screens/PairingScreen.tsx`

**Triggers:** rendered by `App.tsx` when `useBoothCredentials` returns `null` (no stored credentials).

**Two modes (user can toggle):**

**Mode A — QR Scan (default):**
- Uses the existing webcam (`getUserMedia`)
- Reads frames via `requestAnimationFrame` and decodes with `jsQR`
- On decode: extracts the 6-char code string, calls `POST /booths/pair`
- Shows animated viewfinder overlay

**Mode B — Manual input:**
- Large touch-friendly input for the 6-char code (uppercase auto)
- "Parear" button
- Calls `POST /booths/pair`

**On success (either mode):**
1. Calls `totemAPI.setCredentials({ boothId, boothToken })`
2. `window.location.reload()` — app restarts with credentials in store

**On error:**
- `404` / expired code → "Código inválido ou expirado. Gere um novo no painel."

---

## Section 7 — App.tsx Integration (Totem)

`App.tsx` gains a loading state:

```typescript
const { boothId, boothToken, isLoading } = useBoothCredentials();

if (isLoading) return <LoadingScreen />;
if (!boothId || !boothToken) return <PairingScreen />;
// existing app rendering uses boothId + boothToken instead of import.meta.env
```

`VITE_BOOTH_ID` and `VITE_BOOTH_TOKEN` env vars are removed entirely from `App.tsx`.

---

## Section 8 — MaintenanceScreen (Totem)

Add "Desparear cabine" button (destructive, red) to the existing `MaintenanceScreen`.

**On tap:**
1. Calls `POST /booths/unpair` (fire-and-forget — best effort)
2. Calls `totemAPI.clearCredentials()`
3. `window.location.reload()` → app shows `PairingScreen`

---

## Section 9 — Dashboard Pairing UI

Inside the existing booth drawer in `BoothsPage.tsx`:

- New "Gerar pareamento" button
- On click: calls `POST /booths/:id/pairing-code` via `usePairingCode` hook
- Opens `PairingModal` component showing:
  - QR code (`QRCodeSVG` from `qrcode.react` — already installed)
  - 6-char code in large monospace font
  - Countdown timer (counts down from 30:00 using `setInterval`)
  - "Regenerar" button (calls endpoint again, resets countdown)
  - On expiry: disables QR + shows "Código expirado. Regenere."
- Badge on booth card: "Pareado" (green) when `pairedAt != null`, "Não pareado" (gray) otherwise

`usePairingCode` hook — `apps/dashboard/src/hooks/api/usePairingCode.ts`:
```typescript
export const usePairingCode = () =>
  useMutation({
    mutationFn: (boothId: string) =>
      api.post(`/booths/${boothId}/pairing-code`).then(r => r.data),
  });
```

---

## File Map

| File | Action |
|---|---|
| `apps/api/prisma/schema.prisma` | Modify — add `pairingCode`, `pairingCodeExpiresAt`, `pairedAt` to Booth |
| `apps/api/src/guards/booth-jwt.guard.ts` | Create |
| `apps/api/src/use-cases/generate-pairing-code.use-case.ts` | Create |
| `apps/api/src/use-cases/generate-pairing-code.use-case.spec.ts` | Create |
| `apps/api/src/use-cases/pair-booth.use-case.ts` | Create |
| `apps/api/src/use-cases/pair-booth.use-case.spec.ts` | Create |
| `apps/api/src/controllers/booths.controller.ts` | Modify — add 3 endpoints, switch to BoothJwtGuard |
| `apps/api/src/app.module.ts` | Modify — register new use cases |
| `apps/dashboard/src/hooks/api/usePairingCode.ts` | Create |
| `apps/dashboard/src/components/PairingModal.tsx` | Create |
| `apps/dashboard/src/pages/BoothsPage.tsx` | Modify — add pairing button + modal + badge |
| `apps/totem/package.json` | Modify — add `electron-store`, `jsqr` |
| `apps/totem/electron/main.ts` | Modify — add store IPC handlers |
| `apps/totem/electron/preload.ts` | Modify — expose store API on `totemAPI` |
| `apps/totem/src/hooks/useBoothCredentials.ts` | Create |
| `apps/totem/src/screens/PairingScreen.tsx` | Create |
| `apps/totem/src/App.tsx` | Modify — use `useBoothCredentials`, show PairingScreen |
| `apps/totem/src/screens/MaintenanceScreen.tsx` | Modify — add unpair button |
