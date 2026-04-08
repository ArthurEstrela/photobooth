# Design: PhotoBooth SaaS — Sistema Incrível

**Data:** 2026-04-07  
**Abordagem:** Refactor Estrutural + Evolução (Abordagem 2)  
**Escopo:** Transformar o monorepo existente em uma plataforma Full SaaS completa

---

## Contexto

O sistema já possui uma base arquitetural sólida:
- Monorepo Turborepo com `apps/totem` (Electron), `apps/api` (NestJS), `apps/dashboard` (React)
- Schema Prisma completo (Tenant → Booth → Event → Template → Payment → PhotoSession)
- Fluxo PIX via MercadoPago com BullMQ (expiração em 2min)
- Motor de câmera com overlay PNG em Canvas
- Sync Engine offline-first (SQLite → S3) com retry automático
- Deploy Railway/Docker + CloudFront

**Lacunas críticas identificadas:**
- `useBoothMachine.ts` — chamada da API de pagamento é um TODO, não implementada
- `BoothGateway` — verificação do token é TODO, sem segurança real
- Countdown 3-2-1 e sessão WebRTC não implementados
- `packages/shared` vazio (sem tipos compartilhados)
- Sem auth para o dashboard (usa `localStorage.getItem('tenantId')`)
- Páginas de Galeria e Cabines são placeholders
- Dados hardcoded no dashboard ("+12%", "42 clientes", "84% conversão")

---

## Seção 1: Fundações

### `packages/shared`

O pacote existe no monorepo mas está vazio. Torna-se o **contrato central** de todo o sistema.

**Enums:**
- `BoothState`: `IDLE | SELECTING_TEMPLATE | WAITING_PAYMENT | IN_SESSION | COUNTDOWN | CAPTURING | PROCESSING | DELIVERY`
- `PaymentStatus`: `PENDING | APPROVED | REJECTED | EXPIRED`
- `OfflineMode`: `BLOCK | DEMO | CREDITS`

**Tipos WebSocket (eventos):**
- `PaymentApprovedEvent`: `{ paymentId, boothId, sessionId }`
- `PaymentExpiredEvent`: `{ paymentId, boothId }`
- `BoothStateUpdateEvent`: `{ boothId, state: BoothState }`
- `PhotoSyncedEvent`: `{ sessionId, photoUrl, tenantId }` — novo, dashboard recebe ao vivo

**DTOs compartilhados:**
- `CreatePixPaymentDto`: `{ boothId, eventId, templateId, amount }`
- `SyncPhotoDto`: `{ sessionId, photoBase64 }`
- `BoothConfigDto`: `{ offlineMode, offlineCredits, branding: { logoUrl, primaryColor, brandName } }`

**Tipos de domínio:** Interfaces `ITenant`, `IBooth`, `IEvent`, `ITemplate`, `IPayment`, `IPhotoSession` — independentes do Prisma.

Elimina todos os `any` críticos e torna o TypeScript estrito de ponta a ponta.

### Auth

**API — novos endpoints:**
- `POST /auth/login` — retorna JWT com `{ tenantId, email, role }`
- `POST /auth/register` — self-service de novos operadores

**Schema Prisma — mudanças:**
- `Tenant`: adiciona `passwordHash: String`, `logoUrl: String?`, `primaryColor: String?`, `brandName: String?`
- Nova tabela `Plan`: `FREE | STARTER | PRO | ENTERPRISE` com campos `maxBooths: Int`, `maxSessionsPerMonth: Int`
- `Tenant`: adiciona FK `planId`

**Dashboard:**
- Páginas `/login` e `/register`
- `AuthContext` global com `useAuth()` hook
- Rotas protegidas com `<ProtectedRoute>`
- Token armazenado em `httpOnly cookie` (mais seguro que localStorage)

**Totem:**
- `BoothGateway.handleConnection()` — implementar verificação real do token via `BoothService` (query no Prisma)
- Fluxo de auth do totem (boothId + token) permanece o mesmo — só falta a verificação

---

## Seção 2: Totem Premium

### Máquina de Estados Expandida

**Fluxo completo:**
```
IDLE → SELECTING_TEMPLATE → WAITING_PAYMENT → IN_SESSION → COUNTDOWN → CAPTURING → PROCESSING → DELIVERY → IDLE
```

Dois novos estados:
- `SELECTING_TEMPLATE`: tela de escolha de moldura antes do pagamento
- `COUNTDOWN`: 3-2-1 animado após pagamento aprovado

`startPayment()` passa a chamar `POST /payments/pix` de verdade, passando o `templateId` selecionado.

### Seleção de Moldura (`SELECTING_TEMPLATE`)

`TemplateSelector.tsx` (existe mas sem implementação) vira tela de carrossel full-screen:
- Preview ao vivo: moldura PNG aplicada sobre feed da câmera em tempo real via Canvas
- O cliente vê exatamente como a foto vai ficar antes de pagar
- Navegação por swipe/toque entre templates do evento

### Countdown Animado (`COUNTDOWN`)

Novo componente `<CountdownOverlay>`:
1. Ao receber `payment_approved` via WebSocket, inicia countdown
2. Exibe "3... 2... 1..." com animação de escala + pulso (Tailwind + CSS keyframes)
3. Flash de tela branca simulando flash de câmera
4. Dispara `capturePhoto()` no `CameraEngine`

Som de câmera configurável por tenant (pode ser silencioso).

### Multi-foto por Sessão

- Config no `Event`: `photoCount: 1 | 2 | 4`
- `useBoothMachine` mantém array `capturedPhotos: string[]`
- Se `photoCount > 1`, após cada captura retorna para estado `COUNTDOWN` até completar
- `CameraEngine` monta **tira de fotos** no canvas antes de imprimir:
  - `photoCount: 2` → layout 1×2 (vertical)
  - `photoCount: 4` → layout 2×2 (grid)
- `canvas.toDataURL()` exporta a tira completa como uma única imagem

### Offline Mode Configurável

`BoothConfig` (recebida ao conectar no WebSocket) inclui `offlineMode` e `offlineCredits`.

Comportamentos:
- `BLOCK`: sem internet, tela de aviso e bloqueio total
- `DEMO`: libera N sessões gratuitas por hora (configurable), sem cobrança
- `CREDITS`: sessões debitadas do saldo pré-carregado no SQLite, sincronizado depois

`useBoothMachine` detecta perda de conexão via `socket.on('disconnect')` e aplica a regra.

No modo `CREDITS`: SQLite local mantém tabela `booth_credits` com saldo. Cada sessão offline debita 1 crédito. Saldo recarregável via dashboard pelo operador.

### White-label no Totem

Ao conectar, o totem recebe `branding: { logoUrl, primaryColor, brandName }` no `BoothConfigDto`.
CSS custom properties aplicadas dinamicamente:
```css
--color-primary: <primaryColor>
```
Logo do tenant exibida na tela IDLE.

---

## Seção 3: Dashboard Full SaaS

### Estrutura de Páginas

```
/login              — Auth
/register           — Signup self-service com onboarding
/                   — Home: KPIs reais
/events             — Gestão de eventos + upload de molduras
/events/:id         — Detalhe do evento + galeria ao vivo
/booths             — Gestão de cabines
/gallery            — Galeria geral com filtros
/payments           — Histórico de pagamentos + export CSV
/settings           — Perfil, white-label, plano atual
/p/:sessionId       — Página pública da foto (polimento)
```

### Galeria ao Vivo

Quando foto sincronizada ao S3, API emite `photo_synced` via WebSocket para o tenant.
`useDashboardSocket` escuta o evento e chama `queryClient.invalidateQueries(['photos'])` — foto aparece na galeria sem refresh.

Galeria com filtros: por evento, por cabine, por data. Grid responsivo com lazy loading.

### Gestão de Cabines (`/booths`)

Cada cabine exibe:
- Status de conexão (online/offline em tempo real via WebSocket)
- Último estado da máquina (`IDLE`, `IN_SESSION`, etc.)
- Sessões realizadas hoje
- Configuração de `offlineMode` editável inline
- Saldo de créditos offline (se modo `CREDITS`)
- Token de autenticação (para configurar no totem físico)

### White-label por Tenant

`/settings` permite:
- Upload de logo (vai para S3, URL salva no `Tenant`)
- Picker de cor primária
- Nome da marca

Totem busca essas configs ao conectar via `BoothConfigDto`.

### Planos

Schema: tabela `Plan` com limites (`maxBooths`, `maxSessionsPerMonth`).
Dashboard exibe uso atual vs. limite com barra de progresso.
Upgrade/downgrade via `/settings` — gerenciado manualmente pelo admin inicialmente.
Schema preparado para integração futura de billing (Stripe/MP Subscriptions).

### KPIs Reais (`/`)

Remove todos os valores hardcoded. API expõe endpoint `GET /metrics` que retorna:
- `totalRevenue`: soma de pagamentos APPROVED do período
- `totalSessions`: contagem de PhotoSessions
- `conversionRate`: `APPROVED / (APPROVED + EXPIRED + REJECTED)`
- `activeBooths`: contagem via WebSocket state (booths conectados agora)

---

## Schema Prisma — Diff Completo

Mudanças no schema existente:

```prisma
model Tenant {
  // novo
  passwordHash  String
  logoUrl       String?
  primaryColor  String?
  brandName     String?
  planId        String?
  plan          Plan?    @relation(fields: [planId], references: [id])
}

model Event {
  // novo
  photoCount    Int      @default(1) // 1, 2 ou 4
}

model Booth {
  // novo
  offlineMode    String  @default("BLOCK")
  offlineCredits Int     @default(0)
}

// nova tabela
model Plan {
  id                   String   @id @default(uuid())
  name                 String   // FREE, STARTER, PRO, ENTERPRISE
  maxBooths            Int
  maxSessionsPerMonth  Int
  tenants              Tenant[]
}
```

---

## Sequência de Implementação

1. `packages/shared` — tipos, enums, DTOs
2. Auth — API (login/register) + Dashboard (login page, AuthContext, ProtectedRoute)
3. Schema Prisma — migrations (Plan, campos novos em Tenant/Event/Booth)
4. `BoothGateway` — verificação real de token
5. `useBoothMachine` — implementar `startPayment()`, novos estados, multi-foto
6. `TemplateSelector` — carrossel com preview ao vivo
7. `CountdownOverlay` — animação 3-2-1 + flash
8. `CameraEngine` — suporte a multi-foto (tiras)
9. Offline mode configurável no totem
10. White-label no totem (CSS custom properties)
11. Dashboard `/booths` — gestão com status real-time
12. Dashboard `/gallery` — galeria ao vivo com filtros
13. Dashboard `/payments` — histórico + export CSV
14. Dashboard `/settings` — white-label + plano
15. Dashboard `/` — KPIs reais (remove hardcode)
16. `GET /metrics` na API
17. Página pública `/p/:sessionId` — polimento
18. Testes críticos (fluxo de pagamento, sync engine)
