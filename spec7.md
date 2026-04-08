# Prompt Master: Etapa 7 - DevOps, Deploy Cloud (Railway/Docker) e Build do Electron (.exe)

## 🎭 Papel do Modelo
Atue como um **Lead Architect, Cloud/DevOps Engineer e Especialista em Monorepos**, com vasta experiência em Docker, CI/CD, AWS, Railway e empacotamento de aplicativos desktop com Electron Builder.

## 🏢 Contexto da Tarefa
Nas etapas 1 a 6, escrevemos todo o código do MVP do "PhotoBooth SaaS": Backend (NestJS + Prisma + BullMQ), Dashboard (React + TanStack Query + Clerk) e o Totem (Electron + React + SQLite).
Agora, na **ETAPA 7**, o objetivo é tirar o sistema do ambiente de desenvolvimento (`localhost`) e prepará-lo para Produção. 

---

## 🎯 Objetivo da Etapa 7
Gere os arquivos de infraestrutura, orquestração e build necessários para rodar a aplicação na nuvem e empacotar o Totem. A IA deve fornecer o código exato para os seguintes arquivos:

### 1. Dockerfile de Produção do Backend (`apps/api/Dockerfile`)
- Crie um Dockerfile usando **Multi-stage build** (para manter a imagem final extremamente leve).
- A imagem base deve ser `node:18-alpine` (ou 20).
- Certifique-se de instalar as dependências necessárias para o Prisma rodar no Alpine (ex: `openssl`).
- O processo deve gerar o Prisma Client, compilar o NestJS e expor a porta correta.

### 2. Orquestração de Infraestrutura (`docker-compose.yml`)
- Crie um `docker-compose.yml` na raiz do projeto perfeito para testes de integração ou deploy em VPS.
- Deve conter os seguintes serviços:
  - `postgres` (Banco de dados relacional).
  - `redis` (Para as filas do BullMQ da expiração de pagamentos).
  - `api` (O backend NestJS buildado a partir do Dockerfile, conectado ao DB e ao Redis).

### 3. Configuração de Deploy em PaaS (`railway.toml`)
- Assumindo que faremos o deploy do Backend no Railway (por ser rápido e moderno), crie o arquivo de configuração `railway.toml`.
- Configure o comando de build, comando de start (ex: `npm run start:prod` na pasta api) e o healthcheck.

### 4. Empacotamento do Totem (`apps/totem/electron-builder.json` ou `yml`)
- Crie a configuração do `electron-builder` para gerar o executável do Windows (`.exe`).
- A configuração deve ter foco em um aplicativo de Totem (Kiosk):
  - Target: `nsis` (Instalador clássico) ou `portable`.
  - Habilitar `runAfterFinish` silencioso, se possível.
  - Definir ícones e informações da empresa (PhotoBooth SaaS).

### 5. Template de Variáveis de Ambiente (`.env.example`)
- Crie um arquivo unificado na raiz demonstrando TODAS as variáveis de ambiente necessárias para o ecossistema funcionar.
- Agrupe por: Banco de Dados, Redis, Mercado Pago, AWS S3, Clerk (Auth), WebSockets e JWT.

---

## 📜 Regras Estritas de Geração de Código

1. **Separação de Arquivos:** Forneça o código em blocos Markdown, colocando o caminho exato do arquivo na primeira linha (ex: `// apps/api/Dockerfile`).
2. **Performance em DevOps:** O Dockerfile NÃO deve conter `devDependencies` na sua camada final. O comando `npm ci` ou `yarn install --frozen-lockfile` deve ser usado.
3. **Resiliência:** O `docker-compose.yml` deve usar `depends_on` e `healthcheck` para garantir que a API só inicie quando o Postgres e o Redis estiverem 100% prontos.
4. **Foco Estrito:** NÃO reescreva códigos TypeScript (Node/React). O foco desta etapa é infraestrutura (YAML, Dockerfile, TOML e JSON).

Após gerar os códigos desta Etapa 7, finalize com um breve guia de 3 passos de como o Desenvolvedor deve rodar isso na própria máquina para testar o ambiente de Produção.