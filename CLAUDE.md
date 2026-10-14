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
| Testes       | vitest / jsdom                                               | 5.0 / 29.1        |
|              | @testing-library/react / user-event / jest-dom               | 16.3 / 14.6 / 7.0 |
|              | @playwright/test (E2E com o Edge do sistema, sem downloads)  | 1.64              |
| Qualidade    | oxlint (não ESLint) / prettier + prettier-plugin-tailwindcss | 1.88 / 3.9 / 0.8  |

**Ainda não instalados** (previstos no plano, entram na etapa em que forem precisos): `recharts`, `date-fns`.

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
      form/                   # TextField, SegmentedControl (rádios nativos), FormAlert — todos compatíveis com register()
      layout/                 # AppShell, Sidebar, BottomNav, AppLogo, PageHeader, EmptyState, FullScreenLoader, NotFoundPage, nav-items.ts
      theme/                  # ThemeProvider, theme-context (useTheme), ThemeToggle
    features/<área>/          # páginas e lógica por funcionalidade
      auth/                   # AuthProvider, auth-context (useAuth), route-guards, UserCacheBoundary, schemas, auth-errors, páginas
      categories/             # categories-api, hooks, schemas, category-options (cores/ícones), CategoriesPage, CategoryFormDialog
    lib/
      supabase.ts             # cliente único (createClient<Database>)
      supabase-config.ts      # valida VITE_SUPABASE_*; recusa chaves secretas
      query-client.ts         # TanStack Query (staleTime 30 s)
      db-errors.ts            # dbErrorMessage (código Postgres/PostgREST → português), UserFacingError
      money.ts                # centavos: parseMoney, formatMoney, centsToInput
      database.types.ts       # GERADO por `npm run db:types` — não editar à mão
      theme.ts, utils.ts      # funções puras + testes ao lado
    test/setup.ts             # jest-dom + cleanup após cada teste
    test/render-app.tsx       # renderApp(path, fakeAuth(...)): app completa com autenticação falsa
```

**Rotas** (`src/routes.tsx`):

| Caminho                     | Página               | Acesso                                   | Estado                        |
| --------------------------- | -------------------- | ---------------------------------------- | ----------------------------- |
| `/entrar`                   | `LoginPage`          | `PublicOnly` (com sessão → app)          | feito                         |
| `/registar`                 | `SignUpPage`         | `PublicOnly`                             | feito                         |
| `/recuperar-senha`          | `ForgotPasswordPage` | `PublicOnly`                             | feito                         |
| `/nova-senha`               | `ResetPasswordPage`  | sessão temporária do link de recuperação | feito                         |
| `/`                         | `DashboardPage`      | `RequireAuth` (sem sessão → `/entrar`)   | placeholder (Etapa 11)        |
| `/transacoes`               | `TransactionsPage`   | `RequireAuth`                            | placeholder (Etapa 9)         |
| `/configuracoes`            | `SettingsPage`       | `RequireAuth`                            | Aparência, Organização, Conta |
| `/configuracoes/categorias` | `CategoriesPage`     | `RequireAuth`                            | feito                         |
| `*`                         | `NotFoundPage`       | `RequireAuth`                            | —                             |

**Autenticação:** só o `AuthProvider` chama `supabase.auth`; páginas e componentes usam `useAuth()` (ações devolvem `{ error }` já traduzido por `auth-errors.ts`, pelo `code` do erro). `RequireAuth` guarda a página pedida em `location.state.from` e o login volta lá — exceto quando a sessão termina dentro da app (botão Sair), para o próximo login começar no Início. Recuperação de senha: e-mail com link → `/nova-senha` (o supabase-js lê o token do URL). Nos testes de componentes usa-se `renderApp(path, fakeAuth({...}))`, sem rede.

**Navegação:** `nav-items.ts` é a fonte única de links. `Sidebar` (visível a partir de `md`, 768px) e `BottomNav` (fixa em baixo, `md:hidden`, respeita `safe-area-inset-bottom`) usam `NavLink`, que marca o ativo com `aria-current="page"`. No telemóvel há um cabeçalho com logo + botão de tema; o `<main>` tem `pb-24` para não ficar por baixo da barra inferior.

**Tema:** valores `light | dark | system`, guardados em `localStorage` na chave `financas-theme`. Regras puras em `src/lib/theme.ts`; `ThemeProvider` aplica a classe `dark` no `<html>` e segue mudanças do sistema. A mesma chave e lógica estão duplicadas no script de `index.html` — se mudar uma, mudar a outra. Acessos a `localStorage` sempre em `try/catch`.

**Supabase local:** API `http://127.0.0.1:54321`, Studio (painel) `http://127.0.0.1:54323`, Mailpit (e-mails de teste) `http://127.0.0.1:54324`, Postgres na porta 54322. Confirmação de e-mail desligada localmente; senha mínima 8 caracteres. As chaves locais são as de demonstração do Supabase, mas mesmo assim só a pública vai para o `.env`.

**Acesso a dados (padrão a repetir em cada tabela):** `features/<área>/<área>-api.ts` é o único ficheiro que chama `supabase.from('<tabela>')`; erros saem como `UserFacingError` com mensagem traduzida (`dbErrorMessage` + mensagens específicas). `hooks.ts` envolve-o em `useQuery`/`useMutation`; as chaves incluem o id do utilizador (`['categories', userId]`) e cada mutação invalida a lista. `UserCacheBoundary` limpa o cache quando o utilizador muda. `user_id` nunca é enviado: a base preenche-o com `auth.uid()`. Valores fixos (tipo receita/despesa) são enums do Postgres → uniões no TypeScript gerado. Cores e ícones guardam-se como chaves, mapeadas para classes/ícones em `category-options.ts` (um teste confirma que as cores coincidem com o CHECK da migration).

**Testes:** três níveis.

- `npm test` — unitários + componentes (`src/**/*.test.ts(x)`, sem rede; variáveis VITE_* fixas em `vite.config.ts`; acesso a dados simulado com `vi.mock('./<área>-api')`; ficheiros do projeto lidos com `import x from '...?raw'`, nunca `node:fs`).
- `npm run test:rls` — integração em `tests/rls/` contra o Supabase local (config `vitest.rls.config.ts`, ficheiros em série, recusa URLs não locais).
- `npm run test:e2e` — Playwright em `e2e/`, desktop e telemóvel, contra o Supabase local; lê os e-mails do Mailpit. Relatórios em `test-results/` (ignorado).

Os tipos de `tests/` e `e2e/` são verificados por `tsconfig.tests.json`.

## Comandos (dentro de `financas/`)

| Comando                              | O que faz                                                             |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npm run dev`                        | Servidor de desenvolvimento (localhost:5173)                          |
| `npm run build`                      | `tsc -b` + build Vite (verifica tipos de src, tests e configs)        |
| `npm run preview`                    | Serve a build                                                         |
| `npm run lint`                       | oxlint com `--deny-warnings` (avisos contam como erro)                |
| `npm test`                           | Vitest uma vez (`npm run test:watch` em modo contínuo)                |
| `npm run test:rls`                   | Testes de integração/RLS contra o Supabase local                      |
| `npm run test:e2e`                   | Testes E2E (Playwright + Edge) contra o Supabase local                |
| `npm run format`                     | Prettier (escreve)                                                    |
| `npm run format:check`               | Prettier (só verifica)                                                |
| `npm run db:start` / `db:stop`       | Liga / desliga o Supabase local (Docker)                              |
| `npm run db:status`                  | Mostra URLs e chaves locais                                           |
| `npm run db:reset`                   | Recria a base local e aplica todas as migrations (apaga dados locais) |
| `npm run db:types`                   | Regenera `src/lib/database.types.ts` a partir da base local           |
| `npm run env:local`                  | Escreve `.env` com o URL e a chave pública locais                     |
| `npx supabase migration new <nome>`  | Cria uma migration vazia em `supabase/migrations/`                    |
| `npx shadcn@latest add <componente>` | Acrescenta um componente shadcn a `components/ui/`                    |

**Primeira vez / outro computador:** `npm install` → `npm run db:start` → `npm run env:local` → `npm run dev`.

**Verificação no fim de cada etapa:** `npm run verify` — corre build, lint, test, format:check, test:rls e test:e2e e **pára à primeira falha** (os dois últimos precisam do Supabase local a correr). Commits só com `npm run verify && git commit …`.

## Convenções de código

- **TypeScript** estrito como configurado (`noUnusedLocals`, `verbatimModuleSyntax` → usar `import type`). Nada de `any` ou `@ts-ignore` para calar erros.
- **Imports** com o alias `@/` (ex.: `@/lib/theme`); imports relativos só dentro da mesma pasta.
- **Estilo:** Prettier (sem ponto e vírgula, aspas simples, 100 colunas, classes Tailwind ordenadas automaticamente). Nomes de código em inglês; textos da interface e comentários em **português de Portugal**.
- **React:** componentes de função com exports nomeados; um componente por ficheiro em `PascalCase.tsx`. Contextos/hooks em ficheiros `.ts` à parte (regra `only-export-components`). Lógica de negócio em funções puras em `src/lib` ou na pasta da feature, testadas sem React.
- **Organização:** código de uma funcionalidade em `src/features/<área>/`; peças partilhadas em `src/components/`; `components/ui/` só para componentes shadcn.
- **Estilos:** só classes Tailwind com os tokens do tema (`bg-background`, `text-muted-foreground`…), nunca cores fixas — garante claro/escuro.
- **Responsividade:** mobile-first; estilos base para telemóvel, `md:` para desktop. Confirmar a 360–390px e ~1280px, sem scroll horizontal.
- **Acessibilidade:** elementos semânticos (`nav`, `main`, `h1` por página), `aria-label` em botões só com ícone, ícones decorativos com `aria-hidden`, foco visível, áreas de toque ≥ 44px, contraste dos tokens do tema.
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
- [ ] 8. **Etapa atual —** Contas (+ RLS + testes)
- [ ] 9. Receitas e despesas (+ RLS, FKs compostas, testes)
- [ ] 10. Cálculos financeiros (`finance.ts`) + testes
- [ ] 11. Dashboard básico → **MVP**

**Fase C — Depois do MVP:** 12. Orçamentos · 13. Filtros e relatórios · 14. Deploy · 15. Google login, PWA, importar/exportar CSV, atualizações otimistas, recorrentes, metas.

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
