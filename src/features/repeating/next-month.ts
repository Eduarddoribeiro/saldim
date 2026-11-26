import type { IsoDate, MonthKey } from '@/lib/dates'

// Quanto vai sair no mês que vem, cartões e conta juntos (pedido de 2026-11-26: "o previsto é do
// cartão ou da conta?"). As faturas que vencem nesse mês (com os recorrentes previstos nos cartões)
// (só a sua parte; a das outras pessoas à parte) mais as despesas da conta com data nesse mês: lançamentos futuros e recorrentes previstos.
// Função pura.

type Movement = { account_id: string; tipo: string; valor_centavos: number; data: IsoDate }

export type NextMonthToPay = {
  month: MonthKey
  /** A sua parte das faturas que vencem no mês (todos os cartões) */
  cartoes: number
  /** A parte de outras pessoas nessas faturas (vão pagar-lhe de volta), da maior para a menor */
  pessoas: { pessoaId: string; centavos: number }[]
  /** Despesas nas contas de dinheiro com data no mês */
  conta: number
  total: number
}

export function nextMonthToPay({
  month,
  today,
  cardMonths,
  movements,
  projected,
  cardIds,
}: {
  month: MonthKey
  today: IsoDate
  cardMonths: readonly {
    month: MonthKey
    meu: number
    pessoas: { pessoaId: string; centavos: number }[]
  }[]
  /** Lançamentos já feitos (os futuros contam) */
  movements: readonly Movement[]
  /** Recorrentes previstos (ainda não lançados) */
  projected: readonly Movement[]
  cardIds: ReadonlySet<string>
}): NextMonthToPay {
  // Só a parte de quem usa a app: as compras de outras pessoas não são gastos seus (T1)
  const row = cardMonths.find((item) => item.month === month)
  const cartoes = row?.meu ?? 0
  const conta = [...movements.filter((movement) => movement.data > today), ...projected]
    .filter(
      (movement) =>
        movement.tipo === 'despesa' &&
        movement.data.slice(0, 7) === month &&
        !cardIds.has(movement.account_id),
    )
    .reduce((sum, movement) => sum + movement.valor_centavos, 0)
  return { month, cartoes, pessoas: row?.pessoas ?? [], conta, total: cartoes + conta }
}
