# Saldo — plano de desenvolvimento

Plano aprovado pelo utilizador em 2026-10-14. O estado de cada etapa está em `CLAUDE.md`; este documento guarda as regras e os critérios de conclusão.

## Regras financeiras (fonte única de verdade)

### Valores monetários

- Guardados **sempre em centavos, inteiros** (`bigint` no Postgres, `number` inteiro no TS). Nunca `float`.
  - _Porquê:_ `0.1 + 0.2 = 0.30000000000000004` em vírgula flutuante; inteiros somam exatamente.
- `valor_centavos` das transações é **sempre positivo** (`CHECK (valor_centavos > 0)`); o sinal vem do `tipo` (`receita` | `despesa`).
- Conversão só nas extremidades, em `src/lib/money.ts`:
  - `parseMoney("1.234,56") → 123456` (vírgula decimal, ponto de milhares, máx. 2 casas; rejeita vazio e texto inválido; negativos só quando explicitamente permitidos, p.ex. saldo inicial de uma conta). Sem vírgula, um ponto seguido de 3 dígitos é separador de milhares (`"1.234"` → 123400) e seguido de 1–2 dígitos é decimal (`"12.5"` → 1250); 4+ dígitos depois do ponto é recusado por ser ambíguo. Máximo 999 999 999,99 (`MAX_CENTS`). Conversão sem vírgula flutuante (só texto + inteiros).
  - `formatMoney(123456, 'BRL') → "R$ 1.234,56"` via `Intl.NumberFormat`.
- Somas e subtrações são sempre feitas em centavos; a divisão por 100 só acontece ao mostrar.

### Período

- Um mês = `data >= 1.º dia do mês` **e** `data < 1.º dia do mês seguinte` (coluna `data` do tipo `date`, sem horas → sem problemas de fuso horário).

### Cálculos (funções puras em `src/lib/finance.ts`)

| Indicador                            | Regra                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receitas do mês                      | Σ `valor_centavos` das transações `receita` no mês                                                                                                                                                |
| Despesas do mês                      | Σ `valor_centavos` das transações `despesa` no mês                                                                                                                                                |
| Resultado do mês                     | Receitas do mês − Despesas do mês (pode ser negativo)                                                                                                                                             |
| Saldo atual da conta                 | `saldo_inicial` + Σ receitas − Σ despesas + Σ transferências recebidas − Σ enviadas, com `data <= hoje`                                                                                           |
| Saldo previsto da conta              | Igual, mas incluindo transações com data futura                                                                                                                                                   |
| Saldo total                          | Σ saldos atuais de todas as contas, **incluindo arquivadas** (arquivar esconde, não apaga dinheiro)                                                                                               |
| Gastos por categoria (mês)           | Σ despesas do mês agrupadas por categoria, ordenadas por valor; % = gasto da categoria / despesas do mês                                                                                          |
| Orçamento — gasto                    | Σ despesas da categoria no mês do orçamento                                                                                                                                                       |
| Orçamento — restante                 | limite − gasto (negativo = ultrapassado)                                                                                                                                                          |
| Orçamento — % usado                  | `Math.round(gasto * 100 / limite)` (inteiro)                                                                                                                                                      |
| Orçamento — estado                   | `ok` < 80 % · `alerta` 80–100 % · `excedido` > 100 % (comparando valores exatos: 100,4 % já é `excedido`)                                                                                         |
| Variação face ao mês anterior        | diferença = atual − anterior (centavos); % = `Math.round(diferença * 100 / Math.abs(anterior))`; sem % quando o anterior é 0                                                                      |
| Receitas × despesas (série)          | Para cada um dos 6 meses que terminam no mês escolhido: as mesmas regras de receitas/despesas/resultado do mês; meses vazios = 0                                                                  |
| Evolução do saldo                    | Saldo total (todas as contas, incluindo arquivadas) com os movimentos até ao corte: último dia do mês; **hoje** no mês atual (bate com o saldo atual); meses futuros = previsão até ao fim do mês |
| Gastos por categoria vs mês anterior | Gastos por categoria do mês e do mês anterior; categorias só com gastos no anterior aparecem numa nota                                                                                            |

- Orçamentos só para categorias do tipo `despesa`; um por (utilizador, categoria, mês); `limite_centavos > 0`.
- A categoria de uma transação tem de ter o mesmo `tipo` da transação (validado no Zod **e** na base de dados).
- Transferências entre contas (C5): tabela `transferencias`; entram só nos saldos (`transferMovements` em `finance.ts`), nunca em receitas, despesas, categorias ou orçamentos. A interface para as registar chega com os pagamentos (C6).
- _Decisão:_ no MVP os cálculos são feitos em TypeScript com funções puras (fáceis de testar e de entender). Se o volume de dados crescer, movemos as somas para views SQL mantendo as mesmas regras e testes.

### Cartões de crédito (cálculos em `src/lib/credit-card.ts`)

Decisões aprovadas (D1–D10); as etapas C5–C8 ainda vão implementar os pagamentos, a página de faturas, os indicadores e os estornos.

- **Configuração** (C2): uma conta do tipo `cartao_credito` tem dia de fechamento F e de vencimento V (1–31), limite (centavos, > 0) e conta de pagamento (uma conta de dinheiro do mesmo utilizador, não um cartão nem o próprio). Começa sem dívida (saldo inicial 0). Regra dos dias, igual no Zod e no CHECK: **F ≠ V** e **não (V > F e F ≥ 28)** — senão, num fevereiro de 28 dias, fechamento e vencimento cairiam no mesmo dia. Prazo (dias do fechamento ao vencimento) fora de 5–25 dias gera um aviso, não um erro. Só dia de fechamento fixo (D8b).
- **Fatura**: identifica-se pelo mês do vencimento. Vencimento = dia V desse mês; fechamento = dia F no mesmo mês se V > F, ou no mês anterior se V < F; dias que o mês não tem passam ao último dia. **Ciclo = [fechamento anterior, fechamento)**: uma compra no dia do fechamento vai para a fatura seguinte (D2a). Os ciclos são contíguos.
- **Parcelas**: total ÷ n em centavos inteiros, **a última leva o resto** (D3c); soma exata. Parcela k: data = data original da compra + (k−1) meses (dia ajustado ao fim do mês), fatura = fatura da compra + (k−1). O consumo conta na **data de cada parcela** (D1a): parcelas futuras ficam no previsto, não no atual. Compra já em curso (D5a): guarda o valor original e n, mas só cria as parcelas a partir da primeira ainda não paga.
- **Sem dupla contagem**: cada parcela é uma despesa uma única vez; o pagamento da fatura é uma transferência entre contas próprias (não é despesa nem tem categoria). **Pagamentos** (C5): uma transferência para o cartão tem sempre `fatura_id` e a FK composta garante que a fatura é desse cartão; não sai dinheiro de um cartão por transferência; sem data futura (D10a, com 1 dia de tolerância porque o servidor usa a data UTC); pagar a mais é permitido (a fatura fica com crédito); um pagamento não se altera (apaga-se e regista-se de novo). D6: uma compra com parcelas numa fatura com pagamentos não se apaga.
- **Faturas e compras na base de dados** (C3): uma compra regista-se só com a função `registar_compra_cartao` (`security invoker`, uma única transação: compra + faturas em falta + parcelas, ou nada). Os mesmos cálculos existem em SQL (`cartao_datas_fatura`, `cartao_fatura_da_compra`, `cartao_valor_parcela`, `cartao_data_parcela`) e são comparados com os de `credit-card.ts` nos testes. Como a função corre com as permissões de quem chama, as regras estão nas tabelas e valem também para escritas diretas: num cartão só há parcelas; cada parcela tem o valor, a data, a categoria e a fatura que a compra determina; a compra tem exatamente as suas parcelas (verificado no fim da transação); as datas da fatura são calculadas pelo servidor e ficam fixas; parcelas e compras não se alteram (só a descrição da parcela) e uma parcela não se apaga sozinha (apaga-se a compra). O limite do cartão não bloqueia compras (é informativo, C7). Na interface (C4), a compra regista-se num diálogo próprio com pré-visualização das parcelas e faturas; uma compra não se edita na v1 (apaga-se e regista-se de novo). Até à C8, os dias de fechamento/vencimento de um cartão com faturas não mudam.
- **Histórico** (D6): operações que afetam faturas com pagamentos não se editam nem apagam; usa-se estorno/correção. Estorno = tipo `estorno` nas transações (D9a). Pagamentos com data futura não são permitidos na v1 (D10a).
- **Indicadores** (D4a, C7): o Início mostra o dinheiro disponível como número principal, com a dívida em cartões, o saldo líquido e o saldo líquido previsto.

## Modelo de dados

| Tabela           | Campos principais                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`       | `id` (= `auth.users.id`), `nome`, `moeda`                                                                                                                                        |
| `accounts`       | `id`, `user_id`, `nome`, `tipo`, `saldo_inicial_centavos` (pode ser negativo), `arquivada`; cartões: `dia_fechamento`, `dia_vencimento`, `limite_centavos`, `conta_pagamento_id` |
| `categories`     | `id`, `user_id`, `nome`, `tipo`, `cor`, `icone`, `arquivada`                                                                                                                     |
| `transactions`   | `id`, `user_id`, `account_id`, `category_id`, `tipo`, `valor_centavos`, `data`, `descricao`, `created_at`; parcelas: `fatura_id`, `compra_id`, `parcela_numero`                  |
| `faturas`        | `id`, `user_id`, `account_id` (cartão), `mes_referencia` (1.º dia do mês do vencimento), `data_fechamento`, `data_vencimento`                                                    |
| `compras_cartao` | `id`, `user_id`, `account_id`, `category_id`, `descricao`, `data_compra`, `valor_total_centavos`, `parcelas`, `parcela_inicial`                                                  |
| `transferencias` | `id`, `user_id`, `conta_origem_id`, `conta_destino_id`, `valor_centavos`, `data`, `descricao`, `fatura_id` (pagamento de fatura)                                                 |
| `budgets`        | `id`, `user_id`, `category_id`, `mes` (1.º dia do mês), `limite_centavos`                                                                                                        |

- Categorias/contas com transações não se apagam (FK `ON DELETE RESTRICT`); arquivam-se.
- Trigger no registo cria o `profile` e as categorias padrão.

## Segurança (Supabase)

- **RLS ativada em todas as tabelas** acima.
- Políticas separadas para `select`, `insert`, `update`, `delete`, todas com `user_id = auth.uid()` — `USING` (que linhas pode ver/alterar) **e** `WITH CHECK` (impede gravar linhas em nome de outro utilizador ou "mudar o dono" num update). Em `profiles`: `id = auth.uid()`.
- `user_id` com `DEFAULT auth.uid()` e `NOT NULL`.
- **Referências do mesmo dono:** FKs compostas `(account_id, user_id) → accounts(id, user_id)` e `(category_id, user_id) → categories(id, user_id)` — impede usar a conta/categoria de outra pessoa numa transação mesmo que se conheça o `id`.
- Políticas só para o papel `authenticated`; o papel `anon` não acede a nada.
- No front-end só a chave pública; a chave secreta (`service_role`) nunca entra no código do browser nem no Git.

## Etapas e critérios de conclusão

### Fase A — Fundação

1. **Projeto base** — Vite + React + TS, Tailwind, shadcn/ui, oxlint, Prettier, Vitest.
   _Pronto quando:_ `dev` mostra uma página; `build`, `lint`, `test`, `format:check` passam.
2. **Layout responsivo** — AppShell (barra inferior no telemóvel, sidebar no desktop), rotas vazias, tema claro/escuro.
   _Pronto quando:_ navegação funciona em largura de telemóvel e desktop.
3. **Supabase local** — `supabase init/start`, cliente `src/lib/supabase.ts`, variáveis em `.env`.
   _Pronto quando:_ a app liga-se ao Supabase local sem erros.

### Fase B — Núcleo do MVP

4. **Autenticação (e-mail + senha)** — registo, login, logout, recuperar senha, rotas protegidas; `profiles` + RLS + trigger.
   _Pronto quando:_ registar, entrar e sair funciona; sem sessão há redirecionamento para o login.
5. **Base de testes de isolamento** — helper que cria dois utilizadores (A e B) no Supabase local; B não lê nem altera o `profile` de A.
   _Pronto quando:_ `npm run test:rls` passa.
6. **Utilitários monetários** — `money.ts` + testes.
7. **Categorias** — tabela + RLS + categorias padrão; ecrã para listar/criar/editar/arquivar. Testes RLS select/insert/update/delete.
8. **Contas** — tabela + RLS; CRUD com saldo inicial. Testes RLS.
9. **Receitas e despesas** — tabela + RLS + FKs compostas; formulário e lista do mês. Testes RLS incluem "B não cria transação com conta/categoria de A".
10. **Cálculos financeiros** — `finance.ts` + testes (meses vazios, limites de mês, datas futuras, saldo negativo, saldo inicial).
11. **Dashboard básico** — seletor de mês, cartões (saldo total, receitas, despesas, resultado), rosca por categoria, últimas transações. → **MVP**

### Fase C — Depois do MVP

12. Orçamentos mensais (+ RLS + testes). Cartões e faturas em etapas C1–C8 (C1 cálculos, C2 configuração, C3 faturas e compras na base de dados, C4 compras na interface, C5 pagamentos, C6 página de faturas, C7 Início e relatórios, C8 estornos e alteração da configuração). 13. Filtros, pesquisa e relatórios. 14. Deploy (requer autorização: serviços externos). 15. Login Google, PWA, exportar/importar CSV, atualizações otimistas, recorrentes, metas.

## Verificação

- `npm test` — unitários e de componentes.
- `npm run test:rls` — integração contra o Supabase local com dois utilizadores.
- `npm run lint`, `npm run build`, `npm run format:check` limpos em cada etapa.
- Verificação visual em largura de telemóvel e desktop quando há UI.
