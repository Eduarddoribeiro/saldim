# Jornada: fechar o dia, sequência, estrelas e a reserva

**Status:** feito (falta aplicar a migration `dias_fechados` em produção)
**Pedido:** 2026-11-26. "Uma gamificação, mesmo que seja só pra mim… ganhando estrela"; "guardar no cofrinho: como registro, o app sabe?".

## Decisões

- **Estrelas por hábitos, não por abrir a app:** o que deixa o Saldim certo (fechar o dia) e o que faz o dinheiro crescer (guardar, pagar a fatura em dia, segurar o dia a dia, mês no azul).
- **Nada de pontos guardados:** as estrelas, o nível e as conquistas calculam-se dos factos que já existem (`features/journey/journey.ts`). Só os dias fechados são novos (tabela `dias_fechados`).
- **Folga semanal:** um dia esquecido por semana (segunda a domingo) não quebra a sequência; o segundo quebra. Hoje ainda aberto não quebra.
- **Só o dia de hoje fecha** (trigger, com um dia de folga para os fusos): não se enche a sequência com dias passados.
- **Guardar é transferência, não despesa:** a reserva é o saldo das contas Poupança/Investimentos; "Guardar agora" abre "Transferir entre contas" (também no `+`). O rendimento não se lê do banco: "Acertar com o valor do banco" lança a diferença como receita "Rendimento" (fora das entradas fixas).

## Estrelas

| O quê                                                         | Estrelas     |
| ------------------------------------------------------------- | ------------ |
| Fechar o dia                                                  | 1            |
| Semana completa (6 ou 7 dias fechados, semana acabada)        | 3            |
| Desafio da semana: dia a dia ≤ 90% do ritmo dos 30 dias antes | 5            |
| Depósito na reserva                                           | 3            |
| Fatura paga por inteiro até ao vencimento                     | 2            |
| Mês acabado no azul                                           | 10           |
| Marcos da reserva: R$ 100, R$ 500, 1 mês de gastos, 3 meses   | 5, 5, 10, 30 |

Níveis: Começando (0), Atento (50), Organizado (150), Planejador (400), Investidor (1.000). 12 conquistas.

## Onde aparece

- Início: selos (dias, estrelas, nível) na faixa do saldo → `/jornada`; cartão "Hoje" (últimos 7 dias, fechar o dia, desafio da semana) com celebração.
- `/jornada`: nível, calendário do mês, de onde vêm as estrelas, conquistas.
- `/guardar`: o pote da reserva, os marcos, "Guardar agora", "Acertar com o valor do banco", últimos depósitos (apagáveis).
- O quadro "Como você fica no fim do mês" deixa de contar a reserva como dinheiro disponível.

## Fora do escopo

Lembrete às 21h (precisa de PWA instalada), ranking, estrelas por abrir a app.
