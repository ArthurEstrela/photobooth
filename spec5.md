# Prompt Master: Etapa 5 - Dashboard B2B (Painel SaaS) com TanStack Query

## 🎭 Papel do Modelo
Atue como um **Lead Architect e Engenheiro de Software Staff/Sênior**, especialista em React, Tailwind CSS, TanStack Query (React Query) e design de APIs RESTful com NestJS.

## 🏢 Contexto da Tarefa
Nas etapas 1 a 4, construímos a infraestrutura do banco de dados (Prisma), o Motor da Câmera no Totem, o Motor de Pagamentos e a Sincronização S3.
Agora, na **ETAPA 5**, vamos construir a interface web para os operadores das cabines em `apps/dashboard` e os respectivos controllers na `apps/api`.

---

## 🎯 Objetivo da Etapa 5
Gere o código robusto, com Clean Architecture e tipagem estrita, para o Painel Administrativo. A IA deve fornecer os seguintes módulos:

### 1. Controllers do SaaS no Backend (`apps/api/src/controllers/tenant.controller.ts` e `event.controller.ts`)
- **`tenant.controller.ts`**: Crie uma rota `GET /tenant/metrics` que retorne o total faturado (`sum(amount)` onde status = APPROVED) e o total de `PhotoSessions`.
- **`event.controller.ts`**: Crie rotas de CRUD completo para a entidade `Event` (Criar, Listar, Atualizar, Deletar).

### 2. Gerenciamento de Dados (Server State) no Frontend (`apps/dashboard/src/hooks/api/useEvents.ts`)
- Utilize o **TanStack Query v5** para gerenciamento de Server State.
- Crie hooks customizados `useEvents` (usando `useQuery` para buscar a lista) e `useCreateEvent` (usando `useMutation` para criar e invalidar a query de listagem).
- Use `axios` ou `fetch` em um arquivo base instanciado.

### 3. Layout Principal do Dashboard (`apps/dashboard/src/components/DashboardLayout.tsx`)
- Crie um layout moderno com Tailwind CSS.
- Deve conter uma Sidebar simples apontando para: "Início", "Eventos", "Galeria" e "Cabines".
- O layout deve ter uma área de conteúdo principal com fundo `bg-gray-50`.

### 4. Tela de Início / Métricas (`apps/dashboard/src/pages/Home.tsx`)
- Uma tela visualmente rica exibindo Cards de KPIs (Faturamento, Sessões).
- Crie o hook `useMetrics` com TanStack Query e consuma aqui para exibir os dados de forma reativa e tipada.

### 5. Tela de Gestão de Eventos (`apps/dashboard/src/pages/EventsPage.tsx`)
- Crie a interface principal onde o operador gerencia as festas.
- A tela deve ter uma tabela/grid listando os eventos salvos (consumindo o hook `useEvents`).
- Adicione um formulário (ou Modal) para criar um Novo Evento (consumindo `useCreateEvent`), com os campos: Nome do Evento, Preço da Sessão e URL da Moldura.

---

## 📜 Regras Estritas de Geração de Código
1. **Separação de Arquivos:** Forneça o código em blocos Markdown e coloque o caminho exato do arquivo na primeira linha.
2. **Tipagem Absoluta:** `strict: true`. Sem uso de `any`.
3. **UX/UI Profissional:** Use Tailwind CSS focado em um produto B2B SaaS Premium.
4. **Boas Práticas de Query:** Implemente query keys bem definidas e invalidação correta no `onSuccess` das mutações para manter a UI sempre atualizada em tempo real com o backend.