# Fixos, guardar dinheiro e o app da mãe

**Status:** feito (falta aplicar a migration `chave_pix` em produção)
**Pedido:** 2026-11-25. "Recorrentes difícil de achar", "o Início tem que mostrar quanto recebo e gasto fixo", "simule CDB com uma parte do que ganho", "o app da minha mãe tem que ser mais simples".

## O que mudou

1. **Início → "Seu mês fixo"** (`FixedMonthCard`): entra (receitas que se repetem), sai (gastos que se repetem), sobra; de onde vem e onde vai (por área); **a pagar no mês que vem** = faturas que vencem nesse mês + despesas da conta com data nesse mês (lançamentos futuros e recorrentes previstos). Antes, "Próximas faturas" só contava os cartões.
2. **Página Fixos** (`/fixos`): junta Recorrentes e Gastos que se repetem. "Sai todo mês" e "Entra todo mês" (cadastrados), os descobertos pela app com "Cadastrar" (formulário preenchido; valor que varia → "Só lembrar"), por área. Os endereços antigos redirecionam.
3. **"Repete todo mês"** no `+` (receita, despesa, compra à vista minha no cartão): depois de registar, cadastra o fixo com o dia da data, a partir do mês seguinte.
4. **Guardar dinheiro** (`/guardar`): sugere 30% da sobra (o dia a dia não está nos fixos). Reserva de emergência = 3 × o gasto médio dos últimos 3 meses completos, com o que já está em contas Poupança/Investimentos. Quanto rende em 1, 2 ou 5 anos: CDB 100% CDI, LCI/LCA 90% CDI (isenta), Tesouro Selic, poupança (0,5% a.m.), com IR regressivo por depósito. Taxas em `savings/rates.ts` (Copom de 04/11/2026: Selic 13,75%), atualizar à mão.
5. **App da mãe** (`/o-que-devo`): quem foi convidado e não tem lançamentos próprios fica só nesta página (sem barra, Extrato, Cartões nem `+`). Topo: quanto pagar e até quando (o atrasado somado) e **Copiar chave Pix** do dono; mês a mês; onde gastou (por categoria). "Abrir o app completo" guarda a escolha no aparelho.

6. **Como você fica no fim do mês que vem** (`features/forecast/`, pedido de 2026-11-26): dinheiro nas contas hoje + o que vai entrar (receitas futuras e recorrentes previstos nas contas) + o que vão te pagar (o atrasado hoje e a parte de cada pessoa nas faturas, no vencimento, nunca mais do que deve) − as faturas que vencem até lá (inteiras: quem paga o banco é você; com os recorrentes previstos no cartão) − o que sai da conta. Mostra o saldo depois de cada movimento e o dia mais apertado; dá para tirar o que vão te pagar; "com o dia a dia" desconta (gasto médio − fixos) por dia até ao fim do mês. O "A pagar no mês que vem" do quadro "Seu mês fixo" conta só a sua parte das faturas e mostra a das outras pessoas à parte.

## Base de dados

Migration `chave_pix`: `profiles.chave_pix` (opcional, 1–120 caracteres, `grant update`); `divida_partilhada` ganha `dono_chave_pix` (as duas funções são apagadas e criadas de novo, com os mesmos grants). Teste em `tests/rls/shared-debt.test.ts`.

## Fora do escopo

Investir de verdade, taxas automáticas, metas com prazo, Tesouro IPCA na simulação.
