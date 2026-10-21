# Próximas faturas por pessoa

**Status:** Em andamento (fase 2 de 2)
**Projeto:** Saldo · **Branch:** feat/proximas-faturas · **Criado em:** 2026-10-21

## Contexto

Quem usa a app quer saber quanto uma pessoa (ex.: a mãe) deve em cada mês que vem — "quanto ela me deve em novembro?". Hoje a página A receber só separa "já vencido" de "em faturas futuras"; para saber o mês é preciso abrir cada fatura de cada cartão em Faturas e somar à mão as compras "para Mãe".

## Objetivo e definição de pronto

- No cartão de cada pessoa, em A receber, sem tocar em nada: o valor de cada um dos próximos 3 meses, o resto somado numa linha "depois", e quanto ela precisa pagar para ficar em dia até ao fim do próximo mês.
- Ao tocar num mês, aparecem as compras desse mês separadas por cartão (nome, parcela k/n, valor).
- Verificação: com os dados reais da mãe (2026-10-21), novembro mostra **R$ 913,70** (Caixa 79,15 · Picpay 679,66 · Itaú 93,62 · Nubank 61,27) e a soma dos meses é igual a "em faturas futuras".

## Avaliação

- **Impacto no que existe:** só a página A receber (`ReceivablesPage`). Nenhuma tabela, migration, RPC ou regra de cálculo existente muda.
- **Riscos:** (1) o mês não bater com "em faturas futuras" quando a pessoa pagou a mais → regra 4 e teste de soma; (2) o cartão da pessoa ficar comprido no telemóvel → só 3 meses + "depois", meses fechados por omissão, verificação a 360px.
- **Esforço:** P (até um dia): os dados já chegam ao ecrã (`useReceivables` traz as parcelas com `fatura_id`; `useInvoices` traz as datas de vencimento); falta agrupar e mostrar.
- **Decisão:** versão completa (é pequena).

## Regras de negócio

1. **Mês = mês do vencimento da fatura** (`faturas.data_vencimento`), não a data da compra. É o mês em que o banco cobra.
2. **Futuro = faturas com vencimento depois de hoje**, a mesma regra do "já vencido" (`dueInvoiceIds`). Uma fatura que vence hoje já está vencida.
3. O valor de um mês = Σ parcelas − Σ estornos da pessoa nas faturas que vencem nesse mês, de todos os cartões juntos.
4. **Pagamentos a mais abatem primeiro os meses mais próximos:** os reembolsos abatem ao já vencido (como hoje); o que sobrar abate novembro, depois dezembro, e assim por diante. Assim a soma dos meses é sempre igual a "em faturas futuras".
5. Mostram-se os **3 primeiros meses com valor**, um a um; os restantes somam-se numa linha "Fevereiro a setembro de 2027" (ou o intervalo real), que também abre.
6. **Para ficar em dia até &lt;último vencimento do próximo mês&gt;** = já vencido + valor do próximo mês. Ex.: 896,51 + 913,70 = R$ 1.810,21 "até 17/11".
7. Sem parcelas futuras (ou tudo já abatido): a secção não aparece.
8. A dívida anterior (D23) já está toda no "já vencido"; não entra em nenhum mês.

## Fluxo do usuário

1. Abre **A receber** (ou toca em "Ver quem deve" no Início).
2. No cartão da Mãe, abaixo de "Deve R$ 2.344,87 · Já vencido: R$ 896,51", vê:
   - "Para ficar em dia até 17/11: **R$ 1.810,21**"
   - Próximas faturas: Novembro R$ 913,70 · Dezembro R$ 213,71 · Janeiro de 2027 R$ 79,20 · Fevereiro a setembro de 2027 R$ 241,75
3. Toca em "Novembro" → abre a lista das compras de novembro por cartão. Toca de novo → fecha.

## Mudanças técnicas

### Banco de dados

Nenhuma. Sem migration nem mudança de RLS.

### Lógica (funções puras)

- `src/features/people/receivable-details.ts`: nova `upcomingByMonth(movements, invoices, receivable)` → lista de meses `{ month, vencimentoFinal, total, cards: [{ cardId, items }] }` já com o abate da regra 4, e `groupUpcoming(months, 3)` → os 3 primeiros + o grupo "depois". `DetailMovement` passa a incluir `descricao`, `parcela_numero`, `account_id` e `pessoa_id` (já vêm de `useBalanceMovements`).
- Teste em `receivable-details.test.ts`.

### Front-end

- Novo `src/features/people/UpcomingInvoices.tsx`, usado no `PersonCard` de `ReceivablesPage.tsx`, entre o resumo e "Ver detalhes".
- Cada mês é um `<details>`/`<summary>` (abre e fecha sem JavaScript, acessível por teclado e leitor de ecrã), com o mesmo estilo dos "Ver detalhes" que já existem.
- Nomes das compras como em PersonDebtDetails (descrição ou categoria); parcela "k/n" a partir de `usePurchases`.
- `useReceivables` passa a expor as faturas (`invoices`) para o componente não pedir de novo.

## Fases

### Fase 1 — Cálculo por mês, com testes

- [x] `upcomingByMonth` e `groupUpcoming` em `receivable-details.ts`
- [x] Testes: agrupa por mês de vencimento juntando cartões; estornos descontam; faturas vencidas ficam de fora; pagamento a mais abate os meses mais próximos; Σ meses = futuro de `receivables`; 3 meses + "depois"; "para ficar em dia" = vencido + próximo mês
- **Pronto quando:** `npm test` passa com os casos acima

### Fase 2 — Mostrar no cartão da pessoa

- [ ] `UpcomingInvoices.tsx` no `PersonCard`
- [ ] Teste de componente em `ReceivablesPage.test.tsx` (meses, valores, abrir um mês)
- [ ] E2E em `e2e/third-parties.spec.ts`: compra 3× para a mãe → "Para ficar em dia até…" e os meses aparecem; sem scroll horizontal
- [ ] Capturas a 360px (claro e escuro) com o utilizador demo
- **Pronto quando:** `npm run verify` passa e as capturas mostram a secção legível no telemóvel

## Reversão

Só código de interface e funções puras: `git revert` do commit da fase. Nada a desfazer na base de dados.

## Fora do escopo

- Partilhar com a pessoa (enviar o resumo por WhatsApp/link)
- Lembretes ou notificações de vencimento
- O mesmo resumo por mês no Início
- Escolher quantos meses mostrar
- Renomear o campo "Dívida anterior" (decidido não fazer, 2026-10-21)

## Registro de execução

- 2026-10-21 — Fase 1 concluída. Decisão: o número da parcela (k de n) é calculado pela ordem das datas das parcelas da compra a partir de `parcela_inicial`, sem mudar a consulta de `listBalanceMovements`; `DetailMovement` não mudou (novo tipo `UpcomingSource`).
- 2026-10-21 — Plano criado com o utilizador (agrupamento por mês com cartões juntos, 3 meses + "depois", "para ficar em dia até" no próximo mês, sempre visível no cartão da pessoa).
