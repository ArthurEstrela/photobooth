# Prompt Master: Etapa 4 - Sync Engine Offline-First e Cloud Storage (AWS S3)

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em Node.js, Electron (Background Workers), resiliência de redes e arquitetura Cloud (AWS S3 / Cloudflare R2).

## 🏢 Contexto da Tarefa
Nas etapas anteriores, construímos o banco de dados, o motor da câmera offline (SQLite) e o sistema de pagamento PIX. 
Agora, na **ETAPA 4**, vamos construir a ponte entre o Totem físico e a Nuvem. Precisamos de um serviço que rode em segundo plano no Electron, busque as fotos offline e faça o upload seguro para o backend (NestJS), que as guardará no S3 e atualizará a sessão.

---

## 🎯 Objetivo da Etapa 4
Gere o código robusto e tipado para a Sincronização Offline e Entrega Digital. A IA deve fornecer os seguintes módulos divididos entre o Totem e a API:

### 1. Motor de Sincronização do Totem (`apps/totem/electron/sync-engine.ts`)
- Crie um script que roda no *Main Process* do Electron usando `setInterval` (ex: a cada 10 segundos).
- O script deve consultar o `better-sqlite3` buscando fotos com `status = 'PENDING'`.
- Para cada foto, ele faz uma requisição HTTP POST para o NestJS (`/photos/sync`).
- Se a API retornar sucesso (200/201), atualiza o registro local no SQLite para `status = 'UPLOADED'`.
- Adicione tratamento de erros de rede (para que a rotina apenas tente de novo no próximo ciclo se o Wi-Fi estiver caído).

### 2. S3 Storage Adapter (`apps/api/src/adapters/storage/s3.adapter.ts`)
- Crie um Adapter no NestJS utilizando o `@aws-sdk/client-s3`.
- Implemente o método `uploadPhoto(sessionId: string, base64Data: string): Promise<string>`.
- O método deve converter o Base64 para Buffer e fazer o upload usando `PutObjectCommand`, retornando a URL pública final da imagem.

### 3. Sincronização e Upload no Backend (Use Case e Controller)
- **`SyncPhotoUseCase.ts`**: Recebe o payload do Totem (`sessionId`, `photoBase64`), chama o `S3Adapter` para subir a imagem e atualiza o array de `photoUrls` na entidade `PhotoSession` no Prisma.
- **`PhotoController.ts`**: Crie a rota `POST /photos/sync` que recebe a imagem e chama o UseCase.

### 4. Tela de Entrega com QR Code (`apps/totem/src/components/DeliveryScreen.tsx`)
- Crie o componente React que será exibido no final da sessão (Estado: `DELIVERY`).
- A tela deve exibir uma mensagem de agradecimento ("Sua foto está sendo impressa!").
- Gere um QR Code dinâmico na tela (usando uma biblioteca como `qrcode.react`). A URL do QR Code não precisa esperar o upload terminar; ela deve apontar para uma rota padrão da sua nuvem, ex: `https://seusaas.com/p/{sessionId}`. Assim, o cliente escaneia o código, guarda o link, e a foto aparecerá lá assim que o *Sync Engine* conseguir subir a imagem.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown e coloque o caminho exato do arquivo na primeira linha (ex: `// apps/totem/electron/sync-engine.ts`).
2. **Tipagem Absoluta:** `strict: true`. Sem uso de `any`.
3. **Resiliência:** O `sync-engine.ts` não pode "crashar" o Electron se a API estiver fora do ar ou o JSON for inválido. Use blocos `try/catch` de forma defensiva.
4. **Foco Estrito:** NÃO gere código do Dashboard Web. O foco agora é exclusivamete tirar a foto do SQLite e colocar no S3.

Após gerar os códigos desta Etapa 4, não faça mais perguntas de continuação. Finalize confirmando que a arquitetura principal do SaaS está concluída.