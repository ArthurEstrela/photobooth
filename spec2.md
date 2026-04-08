# Prompt Master: Etapa 2 - App Totem (Motor de Câmera, Kiosk Mode e Offline SQLite)

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em React, Electron.js (Hardware Access) e HTML5 Canvas.

## 🏢 Contexto da Tarefa
Na Etapa 1, modelamos o banco de dados e os contratos (SaaS PhotoBooth). Agora, na **ETAPA 2**, vamos construir o núcleo do `apps/totem`. 
Este é o aplicativo Electron + React que rodará fisicamente na cabine. Ele precisa ser **Offline-First**, extremamente rápido para capturar fotos e blindado (Kiosk Mode).

---

## 🎯 Objetivo da Etapa 2
Gere o código estrutural e de hardware do Totem. A IA deve fornecer o código completo e tipado em TypeScript para os seguintes módulos do `apps/totem`:

### 1. Electron Main Process & Segurança (`apps/totem/electron/main.ts` e `preload.ts`)
- Configure a janela em **Kiosk Mode absoluto** (`fullscreen: true`, `kiosk: true`, `autoHideMenuBar: true`).
- Ative o `contextIsolation: true` e `nodeIntegration: false`.
- Crie o **Preload Script** (`contextBridge`) expondo uma API segura (`window.totemAPI`) com os seguintes métodos:
  - `printPhoto()`: Dispara `webContents.print({ silent: true })`.
  - `saveOfflinePhoto(data: PhotoData)`: Envia a foto para ser salva no SQLite local.

### 2. Banco de Dados Local Offline (`apps/totem/electron/database.ts`)
- Utilize a biblioteca `better-sqlite3`.
- Crie um script de inicialização que gera uma tabela local `offline_photos` (colunas: `id`, `sessionId`, `photoBase64`, `status` [default: 'PENDING'], `createdAt`).
- O Electron Main Process deve escutar o IPC `saveOfflinePhoto` e inserir o registro nesta tabela.

### 3. Hook de Gerenciamento de Hardware (`apps/totem/src/hooks/useWebcam.ts`)
- Use `navigator.mediaDevices.getUserMedia()`.
- Priorize resolução 1080p ou a máxima disponível.
- Trate erros (ex: "NotAllowedError", "NotFoundError").
- O hook deve retornar `videoRef`, `stream`, `isLoading` e `error`.

### 4. O Sanduíche de Renderização (`apps/totem/src/components/CameraEngine.tsx`)
- Este componente é o coração da cabine. Ele deve exibir o `<video>` ao vivo (espelhado horizontalmente com CSS).
- Implemente a função `capturePhoto()` usando um HTML5 `<canvas>`.
- **A Lógica de Camadas (Sandwich):**
  1. O código desenha o frame exato do vídeo no Canvas (`drawImage`).
  2. Desenha uma imagem `.png` com transparência (a moldura do evento) por cima do vídeo no Canvas.
  3. Utiliza `canvas.toDataURL('image/jpeg', 0.95)` para exportar a foto final achatada.
- Após a captura, o componente deve chamar `window.totemAPI.saveOfflinePhoto(...)` e `window.totemAPI.printPhoto()`.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown e coloque o caminho exato do arquivo na primeira linha (ex: `// apps/totem/electron/main.ts`).
2. **Tipagem Absoluta:** `strict: true`. Crie as interfaces necessárias para os IPCs (ex: `IPhotoData`).
3. **Performance:** O `CameraEngine.tsx` não pode ficar re-renderizando a cada frame. Use `useRef` para referenciar o vídeo e o canvas.
4. **Foco Estrito:** NÃO gere código de NestJS, Dashboard ou Mercado Pago agora. Foco 100% no hardware (Câmera, Electron, SQLite e Impressão).

Após gerar os códigos desta Etapa 2, pare e pergunte: *"Etapa 2 concluída (Motor da cabine). Deseja que eu gere a Etapa 3 (Motor de Pagamentos PIX via NestJS)?"*