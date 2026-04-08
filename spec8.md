# Prompt Master: Etapa 8 - Polimento de Produção (Sync Lock, CloudFront e Auto-Updater)

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, focado em resiliência de sistemas (Prevenção de Race Conditions), redução de custos em Cloud (AWS CloudFront) e deploy contínuo de desktop (Electron Auto-Updater).

## 🏢 Contexto da Tarefa
Temos um MVP de PhotoBooth SaaS 100% funcional. O backend roda em NestJS e o Totem em Electron (React + SQLite).
Nesta etapa final de polimento, precisamos aplicar 3 ajustes críticos em arquivos que já existem para garantir estabilidade e escalabilidade em ambiente de Produção.

---

## 🎯 Objetivo da Tarefa
Refatore e atualize os arquivos listados abaixo com as seguintes regras de negócio estritas:

### 1. Prevenção de "Atropelamento" no Sync Engine (`apps/totem/electron/sync-engine.ts`)
- **O Problema:** Atualmente, o `setInterval` roda a cada 10 segundos. Se a internet estiver lenta e o upload de fotos pesadas demorar 15 segundos, um novo ciclo iniciará antes do anterior terminar, causando envios duplicados e estourando a memória.
- **A Solução:** Crie uma variável `let isSyncing = false;` no escopo do arquivo.
- Dentro do `setInterval`, adicione uma trava de segurança: `if (isSyncing) return;`.
- Marque `isSyncing = true;` no início do processamento (antes de buscar no banco) e garanta que `isSyncing = false;` seja executado no bloco `finally`, não importando se houve erro ou sucesso.

### 2. CDN na Frente do S3 (`apps/api/src/adapters/storage/s3.adapter.ts` e `.env.example`)
- **O Problema:** Entregar as fotos direto da URL bruta do S3 custa caro em taxa de transferência (Egress) e é mais lento para o usuário final que escaneia o QR Code.
- **A Solução:** Atualize o `S3StorageAdapter`. Ele continuará fazendo o upload usando o SDK do S3, mas a URL retornada pelo método `uploadPhoto` deve ser construída usando um domínio do CloudFront.
- Adicione suporte à variável de ambiente `AWS_CLOUDFRONT_DOMAIN` (ex: `d12345abcdef.cloudfront.net`).
- Se a variável existir, retorne `https://${process.env.AWS_CLOUDFRONT_DOMAIN}/${fileName}`. Caso contrário, mantenha o fallback para a URL original do S3.
- Atualize o `.env.example` incluindo essa nova variável.

### 3. Electron Auto-Updater (`apps/totem/electron/main.ts` e `apps/totem/electron-builder.json`)
- **O Problema:** Precisamos atualizar o executável das cabines remotamente, sem intervenção humana.
- **A Solução no `main.ts`:** Importe o `autoUpdater` do pacote `electron-updater`.
- Adicione a chamada `autoUpdater.checkForUpdatesAndNotify();` logo após a inicialização da janela principal no evento `app.whenReady()`.
- **A Solução no `electron-builder.json`:** Adicione a chave `"publish"` na configuração para instruir de onde o app baixará as atualizações (utilize a configuração padrão apontando para o `github` como provider genérico para MVP, ex: `{"provider": "github", "owner": "seu-usuario", "repo": "seu-repo"}`).
- **No `package.json` do `apps/totem`:** Adicione a instrução para instalar a dependência `electron-updater`.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown, colocando o caminho exato do arquivo na primeira linha.
2. **Preservação de Código:** Mantenha a tipagem e a lógica existente intactas (ex: logs, selects do `better-sqlite3`, imports do NestJS). Apenas INSIRA a nova lógica descrita.
3. **Robustez:** Garanta que os blocos `try/catch/finally` do Sync Engine estejam perfeitamente alinhados para nunca deixar a trava `isSyncing` presa em `true`.

Gere o código atualizado para estes arquivos.