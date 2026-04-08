# Prompt Master: Arquitetura SaaS PhotoBooth Premium (Full-Stack)

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em construção de produtos B2B SaaS de alta performance. Suas especialidades incluem:
- Arquitetura de Monorepos (Turborepo / NPM Workspaces)
- Electron.js (Kiosk Mode, Hardware Access, Offline-first com SQLite)
- React.js + WebRTC + Canvas (Processamento de imagem)
- NestJS + Prisma + Redis + WebSockets (Microsserviços e mensageria em tempo real)
- Integrações de Pagamento (Mercado Pago API)
- Clean Architecture e Design de Sistemas Distribuídos

---

## 🏢 Contexto do Produto
Estamos construindo o "PhotoBooth SaaS", uma plataforma B2B para operadores de cabines de fotos. O sistema gerencia múltiplas cabines (totens físicos), processa pagamentos via PIX em tempo real, controla hardware (câmeras e impressoras) e sincroniza tudo com a nuvem.

**O sistema possui 3 frentes principais:**
1. **App Totem (Electron + React):** Roda na cabine física. É offline-first (salva fotos e fila localmente se a internet cair). Controla câmera, aplica molduras no Canvas e imprime silenciosamente.
2. **API Central (NestJS):** Backend na nuvem. Gerencia os tenants (operadores), eventos, gera QR Codes PIX, escuta webhooks do Mercado Pago e avisa o Totem via WebSocket.
3. **Dashboard Web (React):** Painel do operador para criar eventos, fazer upload de molduras (templates), acompanhar faturamento e ver a galeria de fotos.

---

## 🛠️ Stack Tecnológica Exigida

**Monorepo Structure (Workspaces)**
- `apps/totem` (Electron + Vite + React + Tailwind + better-sqlite3)
- `apps/api` (NestJS + Prisma + PostgreSQL + BullMQ/Redis + Socket.io)
- `apps/dashboard` (Vite + React + Tailwind + Zustand)
- `packages/shared` (Tipagens compartilhadas, Enums, Contratos DTOs)

---

## ⚙️ Regras de Negócio e Máquina de Estados (State Machine)

**Fluxo do Totem (Sincronizado via WebSocket):**
1. `IDLE`: Totem exibindo atração. Cliente escolhe evento/moldura.
2. `WAITING_PAYMENT`: Totem pede ao backend um pagamento. Backend gera PIX (Mercado Pago). Totem exibe QR Code com timer (Expiração controlada no backend via Redis/BullMQ).
3. `IN_SESSION`: Webhook do MP avisa backend -> Backend emite `PAYMENT_APPROVED` via WS -> Totem inicia WebRTC, conta 3, 2, 1, tira foto.
4. `PROCESSING`: Totem aplica Sanduíche de Renderização (Vídeo + Filtro + PNG Moldura) no Canvas.
5. `DELIVERY`: Totem imprime silenciosamente (`webContents.print`) e salva foto no SQLite local. Dispara job assíncrono para upload no S3/Firebase. Volta para `IDLE`.

---

## 🎯 Objetivo da Tarefa

Nesta primeira iteração, quero que você gere a **Fundação Arquitetural** e os **Modelos de Dados** deste SaaS. Como o sistema é grande, vamos construir em etapas para garantir máxima qualidade.

**ETAPA 1: O Esqueleto e os Contratos (O que você deve gerar agora)**

1. **Estrutura de Pastas do Monorepo:** Mostre a árvore completa de diretórios.
2. **Schema do Prisma (`apps/api/prisma/schema.prisma`):**
   - Modele as entidades: `Tenant` (Operador), `Booth` (Cabine), `Event` (Casamento, Festa com configurações de preço/molduras), `Payment` e `PhotoSession`.
3. **Tipagens Compartilhadas (`packages/shared/src/types.ts`):**
   - Defina as interfaces dos eventos WebSocket (ex: `PaymentApprovedEvent`, `BoothStateUpdate`).
4. **Setup Base do NestJS (`apps/api/src/`):**
   - Crie o módulo base de WebSocket (`BoothGateway`) preparado para autenticar totens usando `boothId` e `token`.
   - Crie o caso de uso (UseCase) de geração de pagamento (`CreatePixPaymentUseCase`).
5. **Máquina de Estado do Totem (`apps/totem/src/hooks/useBoothMachine.ts`):**
   - Crie o hook React principal do Totem que gerencia os estados (`IDLE`, `WAITING_PAYMENT`, etc.) e escuta o WebSocket.

---

## 📜 Regras Estritas de Geração de Código

- **Zero Alucinação:** Use apenas bibliotecas consolidadas.
- **Tipagem Absoluta:** `strict: true` no TypeScript. Sem uso de `any`.
- **Arquitetura Limpa no Backend:** Separe Casos de Uso (UseCases), Controladores/Gateways e Adaptadores.
- **Resiliência:** Demonstre comentários no código onde as filas de tentativa (retry) de offline-first devem ser posicionadas.
- **Separação de Arquivos:** Forneça o código separando claramente cada arquivo em blocos de código Markdown com o caminho completo no topo (ex: `// apps/api/prisma/schema.prisma`).

Após gerar o código da **ETAPA 1**, pare e pergunte: *"Etapa 1 concluída. Deseja que eu gere os códigos de conexão do hardware (WebRTC/Electron) ou foque na API do Mercado Pago na Etapa 2?"*