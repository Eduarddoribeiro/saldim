# Menos toques no telemóvel e nova cara (Azul-petróleo)

**Status:** Concluído (Fases 1–3 + identidade visual)
**Projeto:** Saldim · **Branch:** claude/saldim-mobile-ux-fqs7g7 · **Criado em:** 2026-11-17

## Contexto

No telemóvel a app está "burocrática": para anotar um gasto do dia é preciso ir às Transações, abrir o formulário, tocar no valor, abrir uma lista nativa com todas as categorias e registrar. Uma compra no cartão é outro botão e outro formulário, com 7 a 9 campos. Pagar uma fatura obriga a abrir o detalhe e depois o formulário. O Início é comprido e as ações estão espalhadas. Todos os fluxos foram apontados como dor; por isso o trabalho está dividido em fases pequenas, a começar pela mais usada.

## Objetivo e definição de pronto

Contagem de toques no telemóvel, **a partir de qualquer ecrã** (escrever o valor não conta como toque):

| Fluxo                                  | Hoje                            | Meta                                        |
| -------------------------------------- | ------------------------------- | ------------------------------------------- |
| Despesa de hoje, conta habitual        | 6 (e só a partir de Transações) | **3**: `+` → categoria → Registrar          |
| Compra à vista no cartão               | 8+ (botão próprio, 2 seletores) | **4**: `+` → cartão → categoria → Registrar |
| Compra parcelada no cartão             | 9+                              | **5–6**: + parcelas com `−`/`+`             |
| Pagar a fatura em aberto (valor total) | 4 + ir a Faturas                | **2** a partir de Faturas ou do Início      |

Verificação: testes de componentes que fazem exatamente essas sequências de toques com `userEvent`, um E2E no projeto `telemovel` e capturas a 360px e 1280px, nos temas claro e escuro.

## Avaliação

- **Relação com o plano:** é nova, não prevista em `docs/plano.md`. Não mexe em regras financeiras: é só interface.
- **Impacto no que existe:** formulários de criação (`TransactionFormDialog`, `PurchaseFormDialog`), `AppShell`/`BottomNav`, `InvoicesPage`, `DashboardPage`. **Nenhuma migration, RPC ou regra de `finance.ts`/`credit-card.ts` muda.** As escritas continuam a usar os mesmos hooks (`useCreateTransaction`, `useRegisterPurchase`, pagamentos de fatura).
- **Riscos:**
  1. Juntar os dois formulários pode esconder regras do cartão (parcelas, "compra em andamento", "de quem é") → o formulário único usa o `purchaseFormSchema` tal como está quando a conta escolhida é um cartão; a pré-visualização das parcelas (`InstallmentPreview`) continua visível.
  2. Os E2E existentes clicam em "Compra no cartão" e "Nova transação" → atualizados na mesma fase (o nome acessível do botão `+` continua a começar por "Novo lançamento").
  3. Grelha de categorias com nomes longos a 360px → `min-w-0` + `truncate`, `expectNoHorizontalScroll`.
  4. Mudar a navegação inferior confunde quem já usa → a Fase 3 só avança depois de confirmares o desenho.
- **Esforço:** M (alguns dias), quase tudo na Fase 1.
- **Decisão:** fases verticais; cada uma deixa a app a funcionar e pode ir para a `main` sozinha.

## Decisões do utilizador (2026-11-17)

- **Paleta Azul-petróleo** (proposta visual com três paletas; escolhida em vez de Verde Saldim e Grafite). O verde fica só no logo.
- **Nomes:** "Transações" → **Extrato** e "Faturas" → **Cartões**. Os caminhos (`/transacoes`, `/faturas`) não mudam.
- **Ordem:** a identidade visual entra junto com a Fase 1 (mexem nas mesmas telas).
- **Capturas antes/depois** em `docs/screenshots/comparacao/` (`scripts/compare-screenshots.mjs`).

## Identidade visual (feita com a Fase 1)

1. Tokens em `src/index.css`: `--primary` petróleo (claro) / azul-claro (escuro); neutros com tom azul; fundo levemente cinzento com cartões brancos; `--hero`, `--hero-2`, `--hero-foreground`, `--hero-accent` (faixa escura, igual nos dois temas) e `--positive` (dinheiro que entra).
2. Início: faixa petróleo com saudação, olho e número principal (`BalanceHero`); atalhos redondos (`QuickActions`: Despesa, Receita, No cartão, Faturas, Receber); o seletor de mês passou para a secção do mês. No telemóvel, o cabeçalho do logo ganha a cor da faixa.
3. **Esconder valores** (o olho): `src/lib/privacy.ts` + `PrivacyToggle`; classe `valores-ocultos` no `<html>` desfoca os números `tabular-nums` (campos de formulário ficam legíveis); escolha no `localStorage` (`saldim-ocultar-valores`).
4. Extrato: um cartão por dia com o saldo do dia ao lado da data; receitas em `text-positive`.
5. Cartões: o cartão desenhado (nome, "A pagar", dias de fecho/vencimento); filtros em pílula.
6. Barra inferior: Início · Extrato · `+` · Cartões · Mais (Mais = Configurações, que agora abre com "Planejamento": Orçamentos e A receber). A sidebar mantém as cinco secções e ganha "Novo lançamento".
7. Listas, painéis e estados vazios com `rounded-2xl` e `bg-card`; controlos segmentados em pílula.

## Regras de interface

1. **Um botão `+` (Novo lançamento) em todas as páginas da app**, fixo acima da barra inferior no telemóvel (o botão flutuante das Transações passa para o `AppShell`); no desktop, um botão "Novo lançamento" na `Sidebar`.
2. **Um formulário só para criar** receita, despesa e compra no cartão. A lista "Pagar com" junta as contas de dinheiro e os cartões ativos, em botões. Se for um cartão, aparecem: parcelas (1× por omissão, com botões `−`/`+`), "De quem é?" (Minha por omissão) e, em "Mais opções", "compra já em andamento". Receita esconde os cartões.
3. **O valor abre já focado**, com teclado numérico (`inputMode="decimal"`), em letra grande.
4. **Categorias em botões com ícone e cor**, ordenadas pelas **mais usadas nos últimos 90 dias** (empate → ordem alfabética); mostram-se 8 e "Mais…" abre as restantes. Sem histórico, a ordem é a de hoje.
5. **Conta pré-escolhida:** a conta de dinheiro mais usada nos últimos 90 dias (sem histórico, ordem alfabética). Um cartão nunca vem pré-escolhido pelo `+` (seria uma surpresa abrir em "compra no cartão"): escolhe-se com um toque, ou pelo atalho "No cartão" do Início, que abre no cartão mais usado. _(Mudado durante a implementação: o plano dizia "conta ou cartão".)_
6. **Data em botões "Hoje" / "Ontem" / "Outra data"** (só "Outra data" mostra o calendário). Hoje por omissão, sempre a data local (`todayIso`).
7. **Descrição continua opcional**, por baixo das categorias.
8. **No telemóvel, o formulário é uma folha que sobe de baixo**, com o botão Registrar sempre visível no fundo, mesmo com o teclado aberto; no desktop continua a ser um diálogo centrado.
9. **Editar não muda:** tocar numa transação continua a abrir o `TransactionFormDialog`, e tocar numa parcela abre o `PurchaseDetailsDialog`.

## Fluxo do usuário (telemóvel)

1. Em qualquer ecrã, toca em `+` → abre a folha com "Despesa" escolhido, o teclado numérico aberto e a conta habitual marcada.
2. Escreve `42,90` → toca em "Mercado" (1.º botão, por ser a mais usada) → toca em "Registrar despesa".
3. Cartão: depois do valor, toca no botão do cartão → aparecem "1× à vista" e "Minha" → categoria → "Registrar compra". As parcelas e as faturas aparecem por baixo antes de confirmar.
4. Erros (sem categoria, valor inválido, erro do servidor) aparecem no campo ou no topo da folha, como hoje (`FormAlert`).

## Mudanças técnicas

### Banco de dados

Nenhuma.

### Lógica pura (testada sem React)

- `src/features/quick-entry/usage-ranking.ts`: `rankByUsage(items, movements, { today, days: 90 })` → ordena categorias e contas pelo uso. Usa `useBalanceMovements` (já carregado no Início, 5 colunas); se faltar alguma coluna (`category_id`), acrescenta-se ao `select` dessa consulta, sem consulta nova.
- `src/lib/dates.ts`: `yesterdayIso()` (+ teste na mudança de mês e de ano).

### Front-end

- **Novo** `src/features/quick-entry/`: `QuickEntrySheet.tsx` (folha + formulário único), `CategoryPicker.tsx` (grelha de botões, "Mais…"), `AccountPicker.tsx` (contas + cartões em botões), `DateShortcut.tsx`, `ParcelasStepper.tsx`, `quick-entry-context.ts` (abrir a folha a partir do `AppShell`, das páginas e do Início).
- Submissão: conta de dinheiro → `useCreateTransaction` com `transactionFormSchema`; cartão → `useRegisterPurchase` com `purchaseFormSchema` (cria a pessoa nova como hoje). Reaproveita `InstallmentPreview`, `SegmentedControl`, `TextField`, `FormAlert`, `useServerAction` e as cores/ícones de `category-options.ts`.
- `components/ui/dialog.tsx` não muda: a folha usa as primitivas do Base UI com classes próprias (`max-md:` em baixo, `rounded-t-2xl`, `pb-[env(safe-area-inset-bottom)]`). Sem dependências novas.
- `TransactionsPage`: sai o botão "Compra no cartão", "Nova transação" e o `+` local; o `PurchaseFormDialog` fica sem uso e é apagado (os seus testes passam para o formulário novo). O `TransactionFormDialog` fica só para editar.

## Fases

### Fase 1 — Lançamento rápido (formulário único + `+` global) ✅

- [x] `usageCounts`/`rankByUsage` (`quick-entry/usage-ranking.ts`) e `addDays` (em vez de `yesterdayIso`) + testes unitários
- [x] `quickEntrySchema` (`quick-entry/schema.ts`): reaproveita `transactionFormSchema` e `purchaseFormSchema`, sem regras duplicadas
- [x] `QuickEntrySheet` com regras 2–8; `+` na barra inferior (`BottomNav`) e na `Sidebar`; atalhos no Início
- [x] Limpar a `TransactionsPage` (regra 9) e apagar o `PurchaseFormDialog`
- [x] Atualizar `CardPurchases.test.tsx`, `TransactionsPage.test.tsx`, `AppShell.test.tsx`, `DashboardPage.test.tsx` e os E2E (helpers `openNewEntry`, `pick`, `pickDate`, `setParcelas`, `goToSection`)
- **Testes:** componentes com as sequências de toques da tabela (despesa em 3, cartão em 4); E2E no telemóvel: despesa a partir do Início e compra parcelada; `expectNoHorizontalScroll` a 360px.
- **Pronto quando:** `npm run verify` passa e as capturas a 360/1280px (claro/escuro) mostram a folha sem cortes nem o teclado a tapar o Registrar.

### Fase 2 — Pagar e receber em 2 toques ✅

- [x] Em Cartões, botão "Pagar" na própria linha de cada fatura com algo em aberto: abre logo o formulário de pagamento já preenchido (valor em aberto, conta de pagamento do cartão, hoje) → "Registrar pagamento" (`InvoiceDetailsDialog` com `startPaying`)
- [x] No Início, aviso "Faturas a pagar" (`invoices/DueInvoices.tsx`) com as faturas vencidas ou a vencer nos próximos 7 dias (`dueSoon` em `invoice-summary.ts`, testado), cada uma com "Pagar"; sem nenhuma, não aparece
- [x] A receber: "Recebi" já abria o formulário com o valor sugerido (já vencido, ou o total) — 2 toques, sem mudanças
- **Testes:** `dueSoon` (unitário), `InvoicesPage.test.tsx` (Pagar → Registrar), `DashboardPage.test.tsx` (aviso só dentro dos 7 dias, pagamento preenchido)

### Fase 3 — Navegação e Início mais curtos

- [x] Barra inferior com 4 destinos + `+` ao centro: **Início · Extrato · `+` · Cartões · Mais** (feito com a Fase 1).
- [x] Início no telemóvel por esta ordem: faixa do saldo → atalhos → aviso de faturas (Fase 2) → dívida/líquido/a receber → este mês → últimas transações → gastos por categoria → contas → gráficos de 6 meses (no fim). No desktop a grelha fica igual. _(Mudado: em vez de secções que abrem com um toque, os gráficos só descem para o fim — menos código e nada escondido.)_
- **Testes:** `AppShell.test.tsx` (links e `aria-current`), `DashboardPage.test.tsx`; verificação visual a 360px.
- **Pronto quando:** `npm run verify` passa e cabe tudo a 360px sem scroll horizontal.

## Reversão

É só interface: cada fase é um commit (ou poucos) e desfaz-se com `git revert`. Não há dados a migrar.

## Fora do escopo

- Editar compras no cartão (continua sem edição, como na v1 da C4)
- Gestos (deslizar para apagar), "Salvar e lançar outra"
- PWA/atalho no ecrã principal e atualizações otimistas (Etapa 15)
- Sugerir a categoria a partir da descrição (ideia para depois, se a Fase 1 não chegar)

## Registro de execução

- 2026-11-17 — Plano criado.
- 2026-11-17 — Fases 2 e 3: "Pagar" nas linhas de Cartões e aviso de faturas no Início; Início reordenado no telemóvel; verde das receitas unificado em `text-positive`.
- 2026-11-17 — Fase 1 + identidade visual. Desvios: regra 5 (cartão nunca pré-escolhido pelo `+`); "Ontem" usa `addDays` (função geral, testada em mudanças de mês/ano/hora); a navegação da Fase 3 (barra com `+` ao centro e "Mais") entrou já, porque o `+` precisava de um lugar fixo; o Início curto da Fase 3 fica para depois. `playwright.config.ts` e o script de capturas aceitam `PW_EXECUTABLE` (Chromium em vez do Edge, para correr num contentor Linux).
