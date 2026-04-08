# Prompt Master: Etapa 6 - Polimento SaaS Premium (Multi-Templates, Real-Time Dashboard, Guest Page & Auth)

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em React, NestJS, Socket.io, TanStack Query e Clerk (Autenticação SaaS).

## 🏢 Contexto da Tarefa
Nas etapas anteriores (1 a 5), finalizamos o MVP: Totem rodando offline-first com Electron, pagamentos via Mercado Pago, Cloud Sync com S3 e um Dashboard básico.
Agora, na **ETAPA 6**, vamos refinar o sistema para nível de produção B2B (Software as a Service), adicionando isolamento de inquilinos (Auth), atualizações em tempo real na web, flexibilidade de molduras para os eventos e a página pública onde o convidado baixa a foto.

---

## 🎯 Objetivo da Etapa 6
Gere o código robusto e tipado para os seguintes módulos, divididos entre o Totem, a API e o Dashboard:

### 1. Atualização do Schema e Multi-Templates (`apps/api/prisma/schema.prisma`)
- Atualize o `Event` no Prisma. Remova `overlayUrl` e crie um relacionamento de 1-para-Muitos com um novo model `Template` (id, eventId, name, overlayUrl).
- Explique brevemente como o Controller de Eventos deve ser ajustado para salvar múltiplos templates.

### 2. Autenticação SaaS (`apps/api` e `apps/dashboard`)
- **Frontend:** Instrua a configuração do **Clerk** (ou Supabase Auth) no `apps/dashboard/src/App.tsx`, protegendo as rotas administrativas e expondo a página pública.
- **Backend:** Crie um Guard no NestJS (`apps/api/src/auth/tenant.guard.ts`) que intercepta o token JWT, valida o usuário e injeta o `tenantId` no Request, garantindo que o Operador A não veja os dados do Operador B.

### 3. Dashboard Real-Time com TanStack Query (`apps/dashboard/src/hooks/useDashboardSocket.ts`)
- Crie um hook no React que conecta o Dashboard ao `BoothGateway` via WebSocket.
- O hook deve escutar eventos como `payment_approved` e `session_completed`.
- Ao receber o evento, utilize o `queryClient.invalidateQueries({ queryKey: ['metrics'] })` do TanStack Query para atualizar os cards de faturamento na tela magicamente, sem refresh.

### 4. O Totem: Seletor de Molduras (`apps/totem/src/components/TemplateSelector.tsx`)
- Crie um componente React para o Totem. Se o evento carregado tiver mais de 1 `Template`, o estado `IDLE` da máquina deve exibir um carrossel simples ou grid para o usuário tocar na moldura que deseja usar ANTES de ir para o pagamento PIX.

### 5. Página Pública do Convidado (`apps/dashboard/src/pages/GuestPhoto.tsx`)
- Crie a página mobile-first que o QR Code da cabine irá acessar (ex: `/p/:sessionId`).
- Design com Tailwind: Fundo escuro/elegante, exibindo a foto final da sessão centralizada.
- Adicione um botão gigante de "Baixar Foto" (usando a tag `<a>` com `download` ou fetch blob) e botões de compartilhamento (WhatsApp/Instagram).
- **Importante:** Esta rota NÃO pode estar protegida pelo Clerk/Auth, pois qualquer convidado com o link deve conseguir ver sua própria foto.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown, colocando o caminho exato do arquivo na primeira linha (ex: `// apps/dashboard/src/pages/GuestPhoto.tsx`).
2. **Tipagem Absoluta:** `strict: true`. Sem uso de `any`.
3. **UX Premium:** A página do convidado (`GuestPhoto`) deve focar totalmente em dispositivos móveis, pois 100% dos acessos virão de celulares que escanearam o QR Code na cabine.
4. **Foco Estrito:** Integre com o que já foi construído nas Etapas 1 a 5. Mantenha a Clean Architecture.

Após gerar os códigos desta Etapa 6, finalize confirmando que o sistema atingiu maturidade de produção para um SaaS B2B.