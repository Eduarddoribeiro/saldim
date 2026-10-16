# Saldo — guia do projeto

## Objetivo

**Saldo** é uma aplicação web pessoal de finanças, responsiva (telemóvel e desktop) e com sincronização entre dispositivos (dados no Supabase com login). Permite registar receitas e despesas, acompanhar o saldo, definir orçamentos mensais e ver gastos por categoria.

> Nome: a interface usa **Saldo** (`AppLogo.tsx`, `<title>`). O pacote npm e a pasta continuam `financas`, e a chave do tema em `localStorage` continua `financas-theme` (mudar apagaria a preferência guardada).

## Tecnologias instaladas (versões reais, `npm ls --depth=0`)

Ambiente: Node 22.22, npm 10.9, Windows, Docker Desktop 29 (necessário para o Supabase local).

| Área         | Pacote                                                       | Versão            |
| ------------ | ------------------------------------------------------------ | ----------------- |
| UI           | react / react-dom                                            | 19.3              |
| Build        | vite / @vitejs/plugin-react                                  | 8.3 / 6.1         |
| Linguagem    | typescript                                                   | 6.0               |
| Rotas        | react-router                                                 | 8.4               |
| Estilos      | tailwindcss + @tailwindcss/vite                              | 4.3               |
| Componentes  | shadcn (CLI, devDependency) estilo `base-nova`               | 4.21              |
|              | @base-ui/react (primitivas — **não** Radix)                  | 1.9               |
|              | class-variance-authority / cn / tw-animate-css               | 0.7 / 0.4 / 1.4   |
| Ícones/fonte | lucide-react / @fontsource-variable/geist                    | 1.57 / 5.3        |
| Backend      | @supabase/supabase-js / supabase (CLI, devDependency)        | 2.117 / 2.121     |
| Formulários  | react-hook-form / zod / @hookform/resolvers                  | 7.90 / 4.6 / 5.9  |
| Dados        | @tanstack/react-query                                        | 5.104             |
| Gráficos     | recharts (+ react-is na versão do React), carregado à parte  | 3.10              |
| Testes       | vitest / jsdom                                               | 5.0 / 29.1        |
|              | @testing-library/react / user-event / jest-dom               | 16.3 / 14.6 / 7.0 |
|              | @playwright/test (E2E com o Edge do sistema, sem downloads)  | 1.64              |
| Qualidade    | oxlint (não ESLint) / prettier + prettier-plugin-tailwindcss | 1.88 / 3.9 / 0.8  |

**Gráficos:** o Recharts só é usado nos gráficos de evolução do Início (`features/dashboard/charts.tsx`, carregado com `lazy`). Os gastos por categoria continuam em barras HTML/CSS (mais legíveis que uma rosca e acessíveis como lista). Cada gráfico é `role="img"` com descrição e tem uma tabela alternativa; as cores das séries (`--chart-receitas`/`--chart-despesas` em `index.css`) foram validadas para daltonismo e contraste nos dois temas. **Não instalado, de propósito:** `date-fns` — as poucas operações de datas estão em `src/lib/dates.ts` (testadas, com `Intl`).

Notas:

- Tailwind v4 não tem `tailwind.config`: tema e cores (variáveis oklch, claro/escuro) estão em `src/index.css`.
- `cn` é o pacote oficial do shadcn (substitui clsx + tailwind-merge); `src/lib/utils.ts` reexporta-o.
- `shadcn` está em devDependencies de propósito: só é usado pela CLI e pelo import de CSS resolvido na build. As vulnerabilidades do `npm audit` vêm dessa CLI; `npm audit --omit=dev` deve dar 0. **Não** correr `npm audit fix --force` (faz downgrade para shadcn 1.0.0).

## Arquitetura atual

```
financas/                     # raiz do repositório Git
  index.html                  # script inline aplica o tema antes do React (evita flash)
  docs/plano.md               # regras financeiras, modelo de dados, critérios por etapa
  scripts/write-local-env.mjs # gera .env a partir do Supabase local (só URL + chave pública)
  supabase/
    config.toml               # Supabase local (project_id "saldo"; storage/realtime/edge/analytics desligados)
    migrations/               # SQL versionado: tabelas, RLS, triggers
  tests/rls/                  # integração contra o Supabase local (helpers.ts: createTestUser, anonClient)
  e2e/                        # Playwright: fluxos reais no browser (helpers.ts: signUp, logIn, logOut, lastEmailLink)
  playwright.config.ts        # projetos "desktop" (1280×800) e "telemovel" (Pixel 7); arranca o Vite sozinho
  src/
    main.tsx                  # ThemeProvider > QueryClientProvider > AuthProvider > UserCacheBoundary > RouterProvider
    routes.tsx                # array de rotas (reutilizado nos testes com createMemoryRouter)
    index.css                 # Tailwind + tokens de tema shadcn
    vite-env.d.ts             # tipos das variáveis VITE_*
    components/
      ui/                     # gerado pelo shadcn (button, input, label, card, dialog, alert-dialog) — textos traduzidos, lint relaxado
      form/                   # TextField, SelectField (select nativo, placeholder), SegmentedControl, FormAlert, ArchiveDeleteActions (arquivar opcional), ConfirmDeleteButton, use-server-action
      month/                  # MonthPicker, useMonthParam (mês no endereço: ?mes=YYYY-MM)
      layout/                 # AppShell, Sidebar, BottomNav, AppLogo, PageHeader, EmptyState, FullScreenLoader, NotFoundPage, nav-items.ts
      theme/                  # ThemeProvider, theme-context (useTheme), ThemeToggle
    features/<área>/          # páginas e lógica por funcionalidade
      auth/                   # AuthProvider, auth-context (useAuth), route-guards, UserCacheBoundary, schemas, auth-errors, páginas
      categories/             # categories-api, hooks, schemas, category-options (cores/ícones), CategoriesPage, CategoryFormDialog
      accounts/               # accounts-api (accountRow, mensagens por regra), card-days-api + card-days (histórico de dias dos cartões), hooks, schemas (campos do cartão), account-options (tipos de conta, isCreditCard), AccountsPage, AccountFormDialog (aviso ao mudar os dias)
      profile/                # profile-api, hooks (useProfile, useCurrency)
      transactions/           # transactions-api (paginado), hooks (useTransactions, useBalanceMovements), schemas, TransactionsPage, TransactionRow, TransactionFormDialog
      dashboard/              # DashboardPage, StatTile, CategorySpendingList, category-ranking (top 5 + "Outras")
      budgets/                # budgets-api (inclui copyBudgets), hooks, budget-status (cor+ícone+texto), BudgetsPage, BudgetFormDialog
      recurring/              # recurring-api, generate-api (RPC gerar_recorrencias; simulado em src/test/setup.ts), hooks, schemas, recurring-options (textos), RecurringPage, RecurringFormDialog, RecurringGenerator (no AppShell)
    lib/
      supabase.ts             # cliente único (createClient<Database>)
      supabase-config.ts      # valida VITE_SUPABASE_*; recusa chaves secretas
      query-client.ts         # TanStack Query (staleTime 30 s)
      db-errors.ts            # dbErrorMessage (código Postgres/PostgREST → português), UserFacingError
      money.ts                # centavos: parseMoney, formatMoney, centsToInput
      money-schema.ts         # moneyField(): campo Zod texto → centavos (allowNegative, positive)
      dates.ts                # todayIso (data LOCAL), monthRange, addMonths, addMonthsClamped, daysBetween, isIsoDate, formatMonth/formatDay
      finance.ts              # regras de cálculo (docs/plano.md): monthSummary, saldos, spendingByCategory, budgetStatus
      credit-card.ts          # cartões: validateCardConfig, invoiceDates, invoiceForPurchase, splitInstallments, installmentSchedule, invoiceStatus
      recurrence.ts           # recorrentes: nextOccurrence (= SQL recorrencia_seguinte), nextOnOrAfter, occurrencesUntil
      pagination.ts           # fetchAllPages: junta páginas de 1000 linhas (limite max_rows do Supabase)
      database.types.ts       # GERADO por `npm run db:types` — não editar à mão
      theme.ts, utils.ts      # funções puras + testes ao lado
    test/setup.ts             # jest-dom + cleanup após cada teste
    test/render-app.tsx       # renderApp(path, fakeAuth(...)): app completa com autenticação falsa
```

**Rotas** (`src/routes.tsx`):

| Caminho                      | Página               | Acesso                                   | Estado                                                   |
| ---------------------------- | -------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `/entrar`                    | `LoginPage`          | `PublicOnly` (com sessão → app)          | feito                                                    |
| `/registar`                  | `SignUpPage`         | `PublicOnly`                             | feito                                                    |
| `/recuperar-senha`           | `ForgotPasswordPage` | `PublicOnly`                             | feito                                                    |
| `/nova-senha`                | `ResetPasswordPage`  | sessão temporária do link de recuperação | feito                                                    |
| `/`                          | `DashboardPage`      | `RequireAuth` (sem sessão → `/entrar`)   | feito (`?mes=YYYY-MM`)                                   |
| `/transacoes`                | `TransactionsPage`   | `RequireAuth`                            | feito (`?mes=YYYY-MM`)                                   |
| `/faturas`                   | `InvoicesPage`       | `RequireAuth`                            | feito (por cartão; filtros Por pagar/Pagas/Todas)        |
| `/orcamentos`                | `BudgetsPage`        | `RequireAuth`                            | feito (`?mes=YYYY-MM`)                                   |
| `/configuracoes`             | `SettingsPage`       | `RequireAuth`                            | Aparência, Organização, Conta                            |
| `/configuracoes/categorias`  | `CategoriesPage`     | `RequireAuth`                            | feito                                                    |
| `/configuracoes/contas`      | `AccountsPage`       | `RequireAuth`                            | feito (mostra saldo inicial; saldo atual na Etapa 10/11) |
| `/configuracoes/recorrentes` | `RecurringPage`      | `RequireAuth`                            | feito (R1)                                               |
| `*`                          | `NotFoundPage`       | `RequireAuth`                            | —                                                        |

**Autenticação:** só o `AuthProvider` chama `supabase.auth`; páginas e componentes usam `useAuth()` (ações devolvem `{ error }` já traduzido por `auth-errors.ts`, pelo `code` do erro). `RequireAuth` guarda a página pedida em `location.state.from` e o login volta lá — exceto quando a sessão termina dentro da app (botão Sair), para o próximo login começar no Início. Recuperação de senha: e-mail com link → `/nova-senha` (o supabase-js lê o token do URL). Nos testes de componentes usa-se `renderApp(path, fakeAuth({...}))`, sem rede.

**Navegação:** `nav-items.ts` é a fonte única de links (Início, Transações, Faturas, Orçamentos, Configurações; a barra inferior tem 5 colunas com rótulos de 10px, verificada a 360px — rever se crescer). `Sidebar` (visível a partir de `md`, 768px) e `BottomNav` (fixa em baixo, `md:hidden`, respeita `safe-area-inset-bottom`) usam `NavLink`, que marca o ativo com `aria-current="page"`. No telemóvel há um cabeçalho com logo + botão de tema; o `<main>` tem `pb-24` para não ficar por baixo da barra inferior.

**Tema:** valores `light | dark | system`, guardados em `localStorage` na chave `financas-theme`. Regras puras em `src/lib/theme.ts`; `ThemeProvider` aplica a classe `dark` no `<html>` e segue mudanças do sistema. A mesma chave e lógica estão duplicadas no script de `index.html` — se mudar uma, mudar a outra. Acessos a `localStorage` sempre em `try/catch`.

**Supabase local:** API `http://127.0.0.1:54321`, Studio (painel) `http://127.0.0.1:54323`, Mailpit (e-mails de teste) `http://127.0.0.1:54324`, Postgres na porta 54322. Confirmação de e-mail desligada localmente; senha mínima 8 caracteres. As chaves locais são as de demonstração do Supabase, mas mesmo assim só a pública vai para o `.env`.

**Acesso a dados (padrão a repetir em cada tabela):** `features/<área>/<área>-api.ts` é o único ficheiro que chama `supabase.from('<tabela>')`; erros saem como `UserFacingError` com mensagem traduzida (`dbErrorMessage` + mensagens específicas). `hooks.ts` envolve-o em `useQuery`/`useMutation`; as chaves incluem o id do utilizador (`['categories', userId]`) e cada mutação invalida a lista. `UserCacheBoundary` limpa o cache quando o utilizador muda. `user_id` nunca é enviado: a base preenche-o com `auth.uid()`. Valores fixos (tipo receita/despesa) são enums do Postgres → uniões no TypeScript gerado. Enums gerados (`Constants.public.Enums.*`) alimentam as listas da interface, com `Record<Enum, …>` para o TypeScript obrigar a tratar valores novos. Transações: FKs compostas `(account_id, user_id)`/`(category_id, user_id)` com `ON DELETE NO ACTION` (bloqueia apagar conta/categoria em uso, mas permite a cascata ao apagar o utilizador) e trigger que exige categoria do mesmo tipo. As chaves de cache das transações são `['transactions', userId, mes]` e as mutações invalidam o prefixo `['transactions', userId]` (uma edição pode mudar a transação de mês). Datas: só dia (`date`), sempre a data local (`todayIso`), nunca `toISOString()`. **Limite de 1000 linhas:** o Supabase corta respostas em `max_rows` (1000) sem erro — consultas que podem passar disso (transações) usam `fetchAllPages` com ordem total (terminar em `.order('id')`); provado em `tests/rls/pagination.test.ts`. Compras e estornos no cartão: só pelas RPCs `registar_compra_cartao` e `registar_estorno_cartao`; lançamentos recorrentes: só pela RPC `gerar_recorrencias` (chamada pelo `RecurringGenerator` ao abrir a app e depois de criar/mudar uma recorrência). São as únicas chamadas `supabase.rpc` da app. Faturas de cartões cujos dias mudaram: calcular sempre com o histórico (`useCardDaysHistory` + `historyFor`, funções `*WithHistory` de `credit-card.ts`). Cálculos financeiros só em `src/lib/finance.ts` (cartões: `src/lib/credit-card.ts`); o dashboard pede todas as transações (só 5 colunas) e calcula tudo a partir delas (saldos, mês, mês anterior, séries de 6 meses) — decisão do MVP, passar para view SQL se o volume crescer. **Páginas carregadas por rota:** `routes.tsx` usa `lazyPage` (`src/lib/lazy-page.tsx`), com `<Suspense>` no `AppShell`/`AuthLayout`; os testes chamam `preloadPages()` (em `render-app.tsx`) para renderizar de forma síncrona. Formulários com dinheiro usam `moneyField()` e `useForm<Input, unknown, Output>` (entra texto, sai centavos); ao editar, o campo é preenchido com `centsToInput`. Cores e ícones guardam-se como chaves, mapeadas para classes/ícones em `category-options.ts` (um teste confirma que as cores coincidem com o CHECK da migration).

**Testes:** três níveis.

- `npm test` — unitários + componentes (`src/**/*.test.ts(x)`, sem rede: `src/test/setup.ts` bloqueia qualquer `fetch` real; variáveis VITE_* fixas em `vite.config.ts`; acesso a dados simulado com `vi.mock('./<área>-api')`; ficheiros do projeto lidos com `import x from '...?raw'`, nunca `node:fs`). `src/test/source-hygiene.test.ts` falha se houver caracteres invisíveis (ex.: espaço não separável) no código — usar a sequência de escape.
- `npm run test:rls` — integração em `tests/rls/` contra o Supabase local (config `vitest.rls.config.ts`, ficheiros em série, recusa URLs não locais).
- `npm run test:e2e` — Playwright em `e2e/`, desktop e telemóvel, contra o Supabase local; lê os e-mails do Mailpit; `expectNoHorizontalScroll(page)` apanha conteúdo mais largo do que o ecrã (usar em páginas com listas). Relatórios em `test-results/` (ignorado).

Os tipos de `tests/` e `e2e/` são verificados por `tsconfig.tests.json`.

## Comandos (dentro de `financas/`)

| Comando                              | O que faz                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Servidor de desenvolvimento (localhost:5173)                                                                                                 |
| `npm run build`                      | `tsc -b` + build Vite (verifica tipos de src, tests e configs)                                                                               |
| `npm run preview`                    | Serve a build                                                                                                                                |
| `npm run lint`                       | oxlint com `--deny-warnings` (avisos contam como erro)                                                                                       |
| `npm test`                           | Vitest uma vez (`npm run test:watch` em modo contínuo)                                                                                       |
| `npm run test:rls`                   | Testes de integração/RLS contra o Supabase local                                                                                             |
| `npm run test:e2e`                   | Testes E2E (Playwright + Edge) contra o Supabase local; arranca o seu próprio Vite na 5173 (porta ocupada → erro; `E2E_PORT=5174` usa outra) |
| `npm run format`                     | Prettier (escreve)                                                                                                                           |
| `npm run format:check`               | Prettier (só verifica)                                                                                                                       |
| `npm run db:start` / `db:stop`       | Liga / desliga o Supabase local (Docker)                                                                                                     |
| `npm run db:status`                  | Mostra URLs e chaves locais                                                                                                                  |
| `npm run db:reset`                   | Recria a base local e aplica todas as migrations (apaga dados locais)                                                                        |
| `npx supabase migration up --local`  | Aplica só as migrations novas, **sem apagar** os dados locais                                                                                |
| `npm run db:types`                   | Regenera `src/lib/database.types.ts` a partir da base local                                                                                  |
| `npm run env:local`                  | Escreve `.env` com o URL e a chave pública locais                                                                                            |
| `npx supabase migration new <nome>`  | Cria uma migration vazia em `supabase/migrations/`                                                                                           |
| `npx shadcn@latest add <componente>` | Acrescenta um componente shadcn a `components/ui/`                                                                                           |

**Primeira vez / outro computador:** `npm install` → `npm run db:start` → `npm run env:local` → `npm run dev`.

**Verificação no fim de cada etapa:** `npm run verify` — corre build, lint, test, format:check, test:rls e test:e2e e **pára à primeira falha** (os dois últimos precisam do Supabase local a correr). Commits só com `npm run verify && git commit …`.

## Convenções de código

- **TypeScript** estrito como configurado (`noUnusedLocals`, `verbatimModuleSyntax` → usar `import type`). Nada de `any` ou `@ts-ignore` para calar erros.
- **Imports** com o alias `@/` (ex.: `@/lib/theme`); imports relativos só dentro da mesma pasta.
- **Estilo:** Prettier (sem ponto e vírgula, aspas simples, 100 colunas, classes Tailwind ordenadas automaticamente). Nomes de código em inglês; textos da interface e comentários em **português de Portugal**.
- **React:** componentes de função com exports nomeados; um componente por ficheiro em `PascalCase.tsx`. Contextos/hooks em ficheiros `.ts` à parte (regra `only-export-components`). Lógica de negócio em funções puras em `src/lib` ou na pasta da feature, testadas sem React.
- **Organização:** código de uma funcionalidade em `src/features/<área>/`; peças partilhadas em `src/components/`; `components/ui/` só para componentes shadcn.
- **Estilos:** só classes Tailwind com os tokens do tema (`bg-background`, `text-muted-foreground`…), nunca cores fixas — garante claro/escuro.
- **Responsividade:** mobile-first; estilos base para telemóvel, `md:` para desktop. Confirmar a 360–390px e ~1280px, sem scroll horizontal. Itens de grelha/flex com texto longo precisam de `min-w-0` (+ `truncate`), senão alargam a página.
- **Acessibilidade:** botões cujo texto visível não chega (linhas de lista, "Definir") levam `aria-label` explícito que começa pelo texto visível — texto `sr-only` com espaços nas pontas perde os espaços no nome acessível. Elementos semânticos (`nav`, `main`, `h1` por página), `aria-label` em botões só com ícone, ícones decorativos com `aria-hidden`, foco visível, áreas de toque ≥ 44px, contraste dos tokens do tema.
- **Testes:** ficheiro `*.test.ts(x)` ao lado do código. Testes com DOM começam com `// @vitest-environment jsdom`. Testing Library a interagir como o utilizador (papéis e nomes acessíveis, `userEvent`), não detalhes internos.
- **Dinheiro (a partir da Etapa 6):** valores sempre em centavos inteiros, nunca `float`; conversão só ao mostrar ou ao ler input.

## Segurança

- Nunca colocar chaves secretas no frontend. No browser só a chave pública `anon` do Supabase; a `service_role` nunca entra em `src/`, no Git nem em variáveis `VITE_*` (tudo o que começa por `VITE_` vai para o bundle público).
- Configuração por variáveis de ambiente em `.env` (ignorado pelo Git); versionar apenas `.env.example` sem valores reais.
- RLS ativado em **todas** as tabelas com dados privados, com políticas `USING` e `WITH CHECK` por `auth.uid()`. **Receita para cada tabela nova** (migration): `enable row level security`; `revoke all ... from anon` (o Supabase concede tudo ao `anon` por omissão!); políticas separadas por operação, `to authenticated`, com `(select auth.uid())`; `grant update (colunas)` só nas colunas editáveis; funções `security definer` com `set search_path = ''` e `revoke execute`. Depois: `npm run db:reset && npm run db:types` e um `tests/rls/<tabela>-isolation.test.ts` com dois utilizadores (`twoUsers()`).
- `tests/rls/schema-guard.test.ts` falha automaticamente se alguma tabela de `public` ficar sem RLS, sem políticas, com políticas para `anon`/`public`, com privilégios para `anon`, ou com funções `security definer` executáveis pela API. Nunca enfraquecer este teste para fazer passar uma migration.
- Nunca desativar verificações para "resolver" um problema: não desligar RLS, não usar `--no-verify`, não silenciar lint/tipos/testes, não usar `npm audit fix --force` às cegas. Encontrar a causa.
- Antes de cada commit, rever `git status` e o conteúdo preparado: sem `.env`, segredos ou ficheiros desnecessários.

## Plano de desenvolvimento

Regras financeiras, modelo de dados, RLS e critérios de conclusão de cada etapa: **`docs/plano.md`**. Aqui fica só o estado.

**Fase A — Fundação**

- [x] 1. Projeto base (Vite, TS, Tailwind, shadcn, oxlint, Prettier, Vitest) — commit `cb47291`
- [x] 2. Layout responsivo (sidebar/barra inferior, rotas, tema) — verificado com testes e capturas a 360/390/1280px, claro e escuro
- [x] 3. Supabase local (CLI + Docker, cliente validado, `.env` gerado, teste de ligação)

**Fase B — Núcleo do MVP**

- [x] 4. Autenticação e-mail + senha (registo, login, sair, recuperar senha, rotas protegidas), `profiles` + RLS + trigger — testes unitários, componentes, integração e E2E
- [x] 5. Base de testes de isolamento (`twoUsers`, `withLocalDb`, guarda do esquema com prova de falha, isolamento de `profiles`)
- [x] 6. Utilitários monetários (`src/lib/money.ts`: `parseMoney`, `formatMoney`, `centsToInput`, `assertCents`; BRL/pt-BR e EUR/pt-PT) + 45 testes
- [x] 7. Categorias (enum `tipo_movimento`, 12 categorias iniciais por trigger, nome único por tipo, cores/ícones, arquivar/apagar; RLS + isolamento + E2E)
- [x] 8. Contas (enum `tipo_conta`, "Conta principal" criada por trigger, saldo inicial em centavos podendo ser negativo, nome único; RLS + isolamento + E2E)
- [x] 9. Receitas e despesas (FKs compostas, tipo da categoria validado por trigger, lista por mês/dia, criar/editar/apagar; RLS + isolamento + E2E)
- [x] 10. Cálculos financeiros (`src/lib/finance.ts`: monthSummary, accountBalance/balancesByAccount/totalBalance, spendingByCategory, budgetStatus) + 24 testes
- [x] 11. Dashboard básico (saldo atual/previsto, resumo do mês, gastos por categoria em barras, últimas transações, saldo por conta) → **MVP concluído**

**Fase C — Depois do MVP**

- [x] 12. Orçamentos (tabela `budgets` com FK composta e trigger só-despesa, um por categoria/mês, página com estado cor+ícone+texto, copiar do mês anterior sem substituir limites; RLS + isolamento + E2E)
- [x] Dashboard 2 (parte dos relatórios da 13): comparação com o mês anterior (cartões e categorias), receitas × despesas de 6 meses (barras), evolução do saldo (linha, previsão a tracejado), tabelas alternativas; divisão do bundle por rotas. Falta da 13: filtros e pesquisa nas transações.

- [x] **Cartões de crédito** (juntos à `main` e enviados para o GitHub; regras em `docs/plano.md` → "Cartões de crédito"):
  - [x] C1. Cálculos puros (`src/lib/credit-card.ts`: datas e ciclos das faturas, validação dos dias, parcelas, estado da fatura) + testes exaustivos
  - [x] C2. Configuração do cartão: tipo `cartao_credito`, colunas e CHECKs em `accounts` (migration `cartao_config`), FK composta da conta de pagamento, triggers (cartão não paga cartão; conta com transações não muda de/para cartão; transações normais não usam cartões — regra temporária substituída na C3); formulário com campos condicionais e aviso de prazo; cartões fora do formulário de transações; testes RLS (incl. CHECK × `validateCardConfig` nos 961 pares), componentes e E2E
  - [x] C3. Faturas e compras na base de dados (migration `faturas_compras`): tabelas `faturas` (datas calculadas pela trigger, sem update) e `compras_cartao` (sem update; apagar a compra apaga as parcelas); parcelas = transações `despesa` com `fatura_id`, `compra_id`, `parcela_numero` (FKs compostas com o cartão); função atómica `registar_compra_cartao` (`security invoker`); triggers garantem as mesmas regras em escritas diretas (parcela certa na fatura certa, conjunto exato de parcelas no fim da transação, parcelas não se alteram nem se apagam sozinhas; **até à C8:** os dias de um cartão com faturas não mudam); cálculos SQL = `credit-card.ts` provado nas 924 configurações; testes RLS, atomicidade e integridade
  - [x] C4. Compras na interface (`features/card-purchases/`): botão "Compra no cartão" nas Transações (só com um cartão ativo); diálogo com valor total, 1–48 parcelas, categoria de despesa, data, "compra já em curso" (primeira parcela por pagar) e pré-visualização das parcelas e faturas (`installmentSchedule`, os mesmos cálculos do SQL); registo pela RPC `registar_compra_cartao` (`purchases-api.ts`, mutações invalidam compras e transações); parcelas na lista com "Parcela k/n"; tocar numa parcela abre o detalhe da compra (sem edição na v1; apagar apaga todas as parcelas); mensagens para os HINTs da C3; testes de componentes e E2E (3 parcelas, uma por mês, sem duplicar a despesa no Início)
  - [x] C5. Pagamentos na base de dados e nos saldos (migration `transferencias`): tabela `transferencias` (FKs compostas; com `fatura_id` = pagamento, só para o cartão da fatura, sem data futura — D10a; sem update); D6 (compra em fatura com pagamentos não se apaga); `transferMovements` em `finance.ts` junta as transferências só aos saldos do Início (`features/transfers/`); testes dos invariantes (o pagamento não é despesa, o total não muda), RLS e regras
  - [x] C6. Página de faturas (`/faturas`, `features/invoices/`, item novo na navegação): por cartão, filtros Por pagar/Pagas/Todas, estado calculado com `invoiceStatus` (`summarizeInvoices`), total por pagar; detalhe com compras (parcela k/n) e pagamentos; pagar total ou parcialmente (sugere o valor em aberto e a conta de pagamento do cartão; sem data futura) e apagar um pagamento; compras e pagamentos invalidam `['invoices', userId]`; testes de componentes e E2E (pagar em parte, pagar o resto, fatura paga, saldo sem duplicação)
  - [x] C7. Início com cartões (D4a): `netPosition` e `availableCredit` em `finance.ts`; com cartões, o número principal é o dinheiro disponível (contas de dinheiro), com a dívida nos cartões até hoje (as parcelas futuras na dica; negativa = "Crédito nos cartões") e o saldo líquido (= saldo total) com o previsto; sem cartões, o Início fica como estava ("Saldo atual"); cada cartão nas Contas mostra o limite disponível (limite − tudo por pagar, incluindo parcelas futuras) ou quanto foi ultrapassado; as últimas transações mostram "Parcela k/n"; os gráficos já contavam as parcelas pela data (D1a)
  - [x] C8. Estornos e mudança dos dias (migrations `tipo_estorno` e `estornos_dias_cartao`; D11–D14 em `docs/plano.md`): tipo `estorno` nas transações (CHECKs e triggers; função `registar_estorno_cartao`; soma ≤ valor da compra com lock; sem data futura; D6 também para estornos); `finance.ts` trata estornos (crédito no saldo, desconta das despesas e das categorias no mês do estorno); detalhe da compra com estornos (registar parcial, apagar) e linhas "Estorno" nas transações e nas faturas; dias de um cartão com faturas mudam a partir da fatura aberta, com histórico em `cartao_dias_anteriores` e espelho em `credit-card.ts` (`previewDaysChange` explica a mudança no formulário da conta); testes RLS (SQL = TS com histórico, concorrência, escritas diretas), componentes e E2E

- [x] **R1. Lançamentos recorrentes** (branch `feat/recorrentes`; migration `recorrentes`; D15–D18 em `docs/plano.md`): tabela `recorrencias` (RLS, FKs compostas, CHECKs do dia e da frequência, trigger: categoria do tipo certo, cartão só com despesas, próxima data não passada); `transactions.recorrencia_id` (apagar a recorrência mantém os lançamentos); função `gerar_recorrencias` (`security invoker`, cria os que chegaram ao dia incluindo os em atraso, compra à vista no cartão, falhas registadas sem travar as outras, `FOR UPDATE` contra duplicados); página `/configuracoes/recorrentes` (criar, editar, pausar/retomar, apagar, avisos de falha); "Recorrente" nas transações; testes RLS (isolamento, regras, geração, concorrência, SQL = TS em todos os dias de 2027–2028), componentes e E2E

**Seguintes:** 13. Filtros e relatórios · 14. Deploy · 15. Google login, PWA, importar/exportar CSV, atualizações otimistas, metas.

**Próxima etapa:** juntar `feat/recorrentes` (e a correção `fix/select-tema-escuro`) à `main` (precisa de autorização), o resto da 13 (filtros e pesquisa nas transações) e a 14 (deploy, precisa de autorização e credenciais).

### Decisões em aberto (precisam do utilizador)

- **Moeda:** o perfil guarda `BRL` por omissão (o plano aprovado mostrava "R$"); `EUR` também é suportado, mas ainda não há ecrã para mudar a moeda nem o nome do perfil.
- **GitHub:** enviar com `git push` só com autorização explícita de cada vez.
- **Hook `post-commit`:** versionado e sem rede, mas inativo até aprovação (`git config core.hooksPath .githooks`).
- **Deploy / projeto Supabase na cloud (Etapa 14):** exige conta, credenciais reais e possíveis custos; ativar confirmação de e-mail e SMTP próprio em produção.
- **Renomear** o pacote/pasta `financas` → `saldo` (opcional; só cosmético).

## Forma de trabalho

- Uma etapa de cada vez; dentro da etapa, agrupar tarefas relacionadas e não antecipar trabalho de etapas futuras.
- No fim da etapa, correr todas as verificações (secção Comandos) e, quando há UI, confirmar visualmente em largura de telemóvel e de desktop.
- Explicar as decisões técnicas importantes em linguagem acessível — o utilizador está a aprender. Responder em português.
- **Aguardar aprovação explícita** antes de cada commit e antes de avançar para a etapa seguinte. Mensagens de commit no formato `Etapa N: descrição`.
- Não marcar etapas como concluídas sem verificar o código e as verificações.

## Git e GitHub

- Repositório remoto **privado**: `origin` → https://github.com/Eduarddoribeiro/saldo (ramo `main`). O `gh` está instalado em `C:\Program Files\GitHub CLI\gh.exe` e autenticado.
- **Nunca fazer `git push` sem autorização explícita do utilizador.** Commits locais são permitidos quando todas as verificações passam e o conteúdo preparado foi revisto.
- `.githooks/post-commit` (versionado) só mostra o commit criado e quantos commits faltam enviar — sem operações de rede. Está **inativo**; ativar só com aprovação: `git config core.hooksPath .githooks`.

## Gestão deste documento

Atualizar o `CLAUDE.md` quando mudarem decisões de arquitetura, dependências relevantes, comandos, convenções ou o estado das etapas. Manter curto e factual: é um guia do estado atual, não um histórico das conversas — detalhes passados ficam no Git.
