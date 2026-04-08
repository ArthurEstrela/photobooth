# Prompt Master: Etapa 3 - API Cloud (Motor de Pagamentos PIX, Webhooks e Redis)

## 🎭 Papel do Modelo

Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em Node.js, NestJS, arquitetura orientada a eventos (EDA), integrações de pagamento e mensageria (Redis/BullMQ).

## 🏢 Contexto da Tarefa

Na Etapa 1, definimos o Monorepo e o `schema.prisma`. Na Etapa 2, construímos o Totem (Electron/Câmera).
Agora, na **ETAPA 3**, vamos construir o núcleo financeiro e de sinalização em tempo real dentro de `apps/api` (Backend NestJS).

---

## 🎯 Objetivo da Etapa 3

Gere o código robusto, escalável e focado em Clean Architecture para o fluxo de pagamento PIX e Webhooks. A IA deve fornecer o código completo em TypeScript para os seguintes módulos:

### 1. Mercado Pago Adapter (`apps/api/src/adapters/mercadopago.adapter.ts`)

- Crie um wrapper/adapter tipado que encapsula a comunicação com a API do Mercado Pago.
- Implemente o método `createPixPayment(amount, description, metadata)`.
- O adapter deve retornar a string do `qr_code`, o `qr_code_base64` e o `id` da transação no MP.

### 2. Casos de Uso (Use Cases)

- **`CreatePixPaymentUseCase.ts`**:
  1. Recebe o pedido do Totem (boothId, eventId).
  2. Valida no Prisma.
  3. Chama o `MercadoPagoAdapter`.
  4. Salva o Payment no Prisma com status `PENDING`.
  5. **Crucial:** Adiciona um Job em uma fila do BullMQ/Redis (`payment-expiration`) para expirar o QR Code em 2 minutos.
- **`ProcessWebhookUseCase.ts`**:
  1. Recebe o payload do Webhook do MP.
  2. Atualiza o status do Payment no Prisma para `APPROVED`.
  3. Aciona o `BoothGateway` para emitir o evento WebSocket de aprovação.

### 3. Expirador de Pagamentos (BullMQ Worker) (`apps/api/src/workers/payment-expiration.processor.ts`)

- Crie um processor do BullMQ que escuta a fila `payment-expiration`.
- Se, após 2 minutos, o pagamento no Prisma ainda estiver `PENDING`, ele atualiza para `EXPIRED` e avisa a cabine via WebSocket (`PAYMENT_EXPIRED`) para o Totem voltar à tela inicial (`IDLE`).

### 4. WebSocket Gateway (`apps/api/src/gateways/booth.gateway.ts`)

- Complemente o Gateway da Etapa 1.
- Adicione o método `notifyPaymentApproved(boothId: string, paymentData)`. Ele deve buscar no Map de `connectedBooths` o `socket.id` exato do Totem e emitir o evento `payment_approved`.

### 5. HTTP Controllers (`apps/api/src/controllers/payment.controller.ts`)

- `POST /payments/pix`: Rota chamada pelo Totem para gerar a cobrança.
- `POST /payments/webhook`: Rota chamada pelo Mercado Pago. Deve validar a requisição e chamar o `ProcessWebhookUseCase`.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown e coloque o caminho exato do arquivo na primeira linha (ex: `// apps/api/src/adapters/mercadopago.adapter.ts`).
2. **Tipagem Absoluta:** `strict: true`. Sem uso de `any`. Utilize os contratos já definidos em `@packages/shared`.
3. **Segurança do Webhook:** Responda ao Mercado Pago com HTTP 200/201 o mais rápido possível (antes de processar a lógica pesada, ou delegue o processamento da notificação de forma assíncrona/background).
4. **Foco Estrito:** NÃO gere código do Frontend (Totem/Dashboard). O foco agora é 100% no Backend (NestJS, Prisma, BullMQ e Mercado Pago).

Após gerar os códigos desta Etapa 3, pare e pergunte: _"Etapa 3 concluída (Motor de Pagamentos e Webhooks). Deseja que eu gere a Etapa 4 (Offline-First Sync e AWS S3)?"_
