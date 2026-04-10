# UI Redesign — PhotoBooth OS SaaS
**Data:** 2026-04-10  
**Scope:** Reescrita total da UI — Dashboard (web) + Totem (Electron)  
**Abordagem:** Reescrita do zero com design system coerente

---

## 1. Design System

### Fundação
- **Fonte:** Inter (Fontsource) — pesos 400/500/600/700
- **Estilo:** Clean/Light — fundo claro, espaçoso, tipografia forte (referência: Stripe/Notion)
- **Cor primária padrão:** `indigo-600` (#4f46e5) — substituível por CSS custom property `--color-primary` para white-label

### Paleta base (Tailwind)
| Token | Uso |
|---|---|
| `gray-50` | Fundo de página |
| `white` | Cards, modais |
| `gray-100` | Bordas, divisores |
| `gray-500` | Texto secundário |
| `gray-900` | Texto principal |
| `indigo-600` | Ação primária, links ativos, badges |
| `green-500` | Online, aprovado |
| `red-500` | Erro, rejeitado |
| `yellow-500` | Pendente |

### Tailwind config
```ts
colors: {
  primary: {
    DEFAULT: 'var(--color-primary, #4f46e5)',
    light: 'var(--color-primary-light, #eef2ff)',
  }
}
```

### Componentes base (packages/ui ou inline em cada app)
| Componente | Variantes |
|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `danger` × `sm/md/lg` |
| `Card` | `bg-white rounded-2xl border border-gray-100 shadow-sm` |
| `Badge` | `success`, `error`, `warning`, `neutral` — pill-shaped |
| `Input` / `Select` / `Textarea` | Focus ring `primary`, borda `gray-200` |
| `Modal` | Backdrop blur, animação `scale-in` suave |
| `Drawer` | Desliza da direita no desktop, bottom sheet no mobile |
| `Skeleton` | Placeholder animado para todos os estados de loading |
| `EmptyState` | Ilustração SVG + mensagem + CTA opcional |
| `Avatar` | Circular, iniciais como fallback |
| `Dropdown` | Menu flutuante com opções |

---

## 2. Dashboard — Layout & Navegação Responsiva

### Desktop (≥1024px)
- Sidebar fixa à esquerda, 256px
- Logo + nome do tenant no topo da sidebar
- Links com ícone + label, item ativo com `bg-primary-light text-primary`
- Avatar + botão Sair no rodapé da sidebar

### Tablet (768–1023px)
- Sidebar colapsada — só ícones visíveis (64px)
- Expande em hover/tap para mostrar labels
- Tooltip no hover de cada ícone quando colapsada

### Mobile (<768px)
- Sem sidebar
- **Header fixo no topo:** logo/nome do tenant à esquerda, avatar à direita
- **Bottom tab bar fixa:** 5 ícones principais — Início, Cabines, Eventos, Galeria, Pagamentos
- Botão "···" na tab bar abre bottom sheet com: Molduras, Analytics, Configurações, Sair

### Ordem de navegação completa
1. Início (LayoutDashboard)
2. Cabines (Smartphone)
3. Eventos (Calendar)
4. Molduras (Layers)
5. Galeria (Image)
6. Pagamentos (CreditCard)
7. Analytics (BarChart2)
8. Configurações (Settings)

---

## 3. Dashboard — Páginas

### 3.1 Home — Visão Geral
**KPI cards (4):** Faturamento Total, Sessões de Fotos, Cabines Online, Taxa de Conversão  
**Gráficos:**
- Linha: faturamento acumulado por dia (30d)
- Barras: sessões por dia (30d)
- No desktop: lado a lado. No mobile: carrossel swipeable com snap

**Feed de atividade:** coluna direita no desktop, seção abaixo dos gráficos no mobile  
- Últimos 5 pagamentos em tempo real via WebSocket (`payment_approved`)
- Cada item: nome do evento, cabine, valor, status badge, timestamp relativo

**Biblioteca de gráficos:** Recharts (já popular no ecossistema React/Tailwind)

---

### 3.2 Cabines
**Layout:** Grid de cards responsivo (1 col mobile, 2 tablet, 3 desktop)

**Card de cabine:**
- Nome + badge Online/Offline
- Evento ativo (nome ou "Nenhum")
- Botão "Configurar"
- Primeiro card do grid: `+` Nova Cabine

**Drawer de configuração (direita no desktop, bottom sheet no mobile):**
- Campo: Nome da cabine
- Campo: Modo Offline (select: Bloquear / Demo / Créditos)
- **Dropdown: Evento Ativo** — lista eventos ativos do tenant. Ao selecionar, cabine herda preço + photoCount + molduras do evento
- Status de conexão (read-only): Online/Offline + último ping

---

### 3.3 Eventos
**Layout:** Tabela no desktop, lista de cards no mobile

**Colunas (desktop):** Nome, Preço, Fotos/Sessão, Preço Digital, Molduras, Sessões realizadas, Ações

**Formulário (modal) — Criar/Editar Evento:**
- Nome do evento
- Preço por sessão (R$)
- Quantidade de fotos (1, 2, 3, 4)
- Preço do digital (R$) — opcional; se vazio, download é gratuito
- **Seleção de molduras:** duas colunas — pool global à esquerda, molduras ativas do evento à direita (drag-and-drop, máximo configurável pelo operador)

---

### 3.4 Molduras
**Layout:** Duas colunas no desktop, tabs no mobile

**Coluna esquerda — Pool Global:**
- Grid de thumbnails (PNG transparente sobre fundo xadrez cinza)
- Nome da moldura abaixo
- Botão "Adicionar Moldura" → modal de upload (drag-and-drop de arquivo PNG para S3)
- Botão de excluir em hover sobre o thumbnail

**Coluna direita — Molduras do Evento:**
- Dropdown de seleção de evento no topo
- Após selecionar: lista das molduras ativas com ordem, drag-and-drop para reordenar
- Máximo exibido = campo `maxTemplates` do evento
- Chips removíveis

---

### 3.5 Galeria
**Layout:** Grid de cards (sessões de fotos)

**Card de sessão:** primeira foto como thumbnail, nome do evento, nome da cabine, badge com contagem de fotos, data relativa

**Filtros:** por data (range picker) e por cabine (select)

**Modal de detalhe:** carrossel das fotos da sessão, botão download individual, botão "Baixar tudo" (zip), data + evento + cabine

**Empty state:** ilustração + "Nenhuma sessão registrada ainda"

---

### 3.6 Pagamentos
**Layout:** Tabela no desktop, lista de cards no mobile

**Colunas:** Data, Evento, Cabine, Valor, Tipo (Principal / Digital Upsell), Status

**Filtros:** status (select) + período (date range picker)

**Botão Exportar:** dropdown com opções CSV e PDF

**CSV:** gera e baixa imediatamente via `URL.createObjectURL`  
**PDF:** usa `@react-pdf/renderer` — relatório formatado com logo do tenant, período, tabela completa, totais

---

### 3.7 Analytics
**Seletor de período:** 7d / 30d / 90d / Personalizado (date range picker)

**Gráficos:**
- Linha: faturamento acumulado no período
- Barras: sessões por dia

**Cards de resumo:**
- Faturamento total do período
- Ticket médio por sessão
- Melhor dia (data + valor)
- Cabine mais ativa (nome + sessões)

**Tabela:** Top 5 eventos por faturamento no período

**Exportar relatório:** botão PDF — relatório com logo, período, todos os gráficos e tabelas

---

### 3.8 Configurações
**Seção — Identidade Visual (White-label):**
- Upload de logo: componente drag-and-drop, envia direto para S3, preview ao vivo após upload
- Nome da marca: input de texto
- Cor primária: color picker + input hex + preview ao vivo (aplica `--color-primary` no DOM instantaneamente)

**Seção — Conta:**
- Email (read-only)
- Botão "Alterar senha" → modal com senha atual + nova senha + confirmação

---

## 4. Totem — Telas e Fluxo

### Orientações suportadas
Portrait (9:16) e Landscape (16:9) via CSS container queries. Todos os layouts se adaptam automaticamente.

### White-label
Ao iniciar, o totem lê `config.branding` do evento ativo:
- `primaryColor` → `--color-primary` no `<html>`
- `logoUrl` → exibido nas telas IDLE e Entrega
- `brandName` → nome exibido nas telas

### Tela IDLE
- Fundo escuro configurável (cor sólida ou imagem de fundo do evento — campo opcional)
- Logo do tenant centralizado e grande
- Nome da marca em tipografia bold, enorme
- "Toque para começar" com animação de pulso na cor primária
- Se `eventLoading`: "Carregando evento..."
- Se sem evento ativo: "Cabine não configurada" (sem tap)

### Tela de Seleção de Molduras
- Grid com as molduras do evento ativo (máximo = `event.maxTemplates`)
- Cada card: preview PNG da moldura sobreposta ao live camera feed como background
- Card selecionado: borda grossa na cor primária + checkmark
- Portrait: 2 colunas. Landscape: 3 colunas
- Botão "Continuar" grande + acessível, desabilitado até selecionar

### Tela de Pagamento (PIX)
- QR Code grande e centralizado
- Valor em destaque (tipografia bold grande)
- Código PIX copiável (tap to copy + feedback visual "Copiado!")
- Barra de progresso circular de expiração (timer visual)
- Botão "Cancelar" discreto no rodapé

### Tela de Câmera / Countdown / Captura
- Live camera feed em tela cheia
- Overlay da moldura selecionada sobre o feed em tempo real
- **Loop de múltiplas fotos:**
  - Indicador "Foto 1 de N" no topo
  - Countdown animado 3-2-1 na cor primária
  - Flash branco no momento da captura
  - 3 segundos → próxima foto
  - Repete até N fotos
- Sem botão de refazer (**regra de negócio: "bateu, levou"**)

### Tela de Processamento
- Spinner elegante na cor primária
- Mensagem dinâmica:
  - 1 foto: "Preparando sua foto..."
  - 2+ fotos: "Montando sua tira de fotos..."

### Tela de Entrega
**Fluxo em dois momentos:**

**Momento 1 — Impressão (automático):**
- Animação de impressora + "Imprimindo sua foto..."
- Dispara IPC `print-photo` imediatamente e silenciosamente (sem janela do Windows)
- Duração: ~2 segundos de animação

**Momento 2 — Digital (upsell ou gratuito):**

*Se `event.digitalPrice` é null (gratuito):*
- QR Code grande
- "Escaneie para baixar sua foto digital"
- Nome da marca
- Countdown "Voltando ao início em Xs..."

*Se `event.digitalPrice` > 0 (upsell):*
- "Quer sua foto no celular?"
- Valor em destaque (ex: "R$ 5,00")
- QR Code de novo PIX (valor menor)
- Botão "Não, obrigado" discreto no rodapé → volta ao IDLE
- Se cliente pagar: QR Code de download aparece + "Obrigado! Escaneie para baixar"

**Sem botão de refazer em nenhum momento.**

---

## 5. Modelo de Dados — Ajustes Necessários

### Event (ajustes)
```
+ digitalPrice    Decimal?   // null = digital gratuito; valor = upsell
+ backgroundUrl   String?    // imagem de fundo opcional para o totem
+ maxTemplates    Int        // máximo de molduras exibidas no totem (default: 5)
+ templates       EventTemplate[]  // relação many-to-many com Template
```

### Template (novo modelo)
```
id          String
tenantId    String
name        String
overlayUrl  String   // URL S3 do PNG transparente
createdAt   DateTime
events      EventTemplate[]
```

### EventTemplate (tabela de junção com ordem)
```
eventId     String
templateId  String
order       Int      // para drag-and-drop
```

### Booth (ajuste)
```
+ activeEventId   String?   // FK para Event — herança automática
- templates       (removido — templates agora pertencem ao Evento)
```

---

## 6. Novos Endpoints de API Necessários

| Método | Rota | Descrição |
|---|---|---|
| GET | `/tenant/templates` | Lista pool global de molduras do tenant |
| POST | `/tenant/templates` | Upload de nova moldura (multipart → S3) |
| DELETE | `/tenant/templates/:id` | Remove moldura do pool |
| GET | `/tenant/events/:id/templates` | Molduras de um evento |
| PUT | `/tenant/events/:id/templates` | Atualiza molduras + ordem de um evento |
| PUT | `/tenant/booths/:id/event` | Define evento ativo da cabine |
| GET | `/tenant/analytics` | Dados agregados (faturamento + sessões por período) |
| POST | `/tenant/settings/logo` | Upload de logo para S3, retorna URL |
| POST | `/payments/digital/:sessionId` | Cria PIX de upsell digital |

---

## 7. Bibliotecas Novas Necessárias

| Biblioteca | Uso |
|---|---|
| `recharts` | Gráficos no dashboard |
| `@react-pdf/renderer` | Exportação de relatórios em PDF |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop de molduras |
| `react-day-picker` | Date range picker para filtros |
| `fontsource/inter` | Fonte Inter local (sem CDN) |

---

## 8. Fora do Escopo deste Redesign
- Impressora física (IPC já existe no Electron — não mexer)
- Sistema de planos/billing
- Multi-idioma
- Notificações push
- Modo demonstração do totem
