import { addDays, daysBetween, type IsoDate } from '@/lib/dates'

// "Como você fica no fim do mês que vem" (pedido de 2026-11-26): o dinheiro das contas hoje, mais o
// que vai entrar e o que vão te pagar, menos as faturas e o que sai da conta, até ao último dia do
// mês que vem. Cada movimento tem data, para ver o dia mais apertado. Função pura, em centavos.

export type ForecastKind = 'entrada' | 'receber' | 'fatura' | 'conta'

export type ForecastEvent = {
  data: IsoDate
  kind: ForecastKind
  descricao: string
  /** Positivo entra, negativo sai */
  valor: number
}

export type ForecastStep = ForecastEvent & { saldo: number }

export type Forecast = {
  until: IsoDate
  disponivel: number
  entradas: number
  receber: number
  faturas: number
  conta: number
  /** Disponível + entradas + receber − faturas − conta */
  sobra: number
  /** Estimativa do dia a dia (o que não é fixo) até `until` */
  diaADia: number
  sobraComDiaADia: number
  /** Os movimentos por data, com o saldo depois de cada um */
  timeline: ForecastStep[]
  /** O saldo mais baixo do caminho (e quando), sem o dia a dia */
  menor: { data: IsoDate; saldo: number }
}

/**
 * `events` com datas de hoje em diante; um evento antes de hoje (fatura vencida por pagar, atraso de
 * quem deve) conta como hoje. `includeReceber` false tira o que vão te pagar (e se atrasarem?).
 * `dailySpending` é o gasto do dia a dia por dia (centavos), contado de amanhã até `until`.
 */
export function forecastUntil({
  today,
  until,
  disponivel,
  events,
  dailySpending,
  includeReceber = true,
}: {
  today: IsoDate
  until: IsoDate
  disponivel: number
  events: readonly ForecastEvent[]
  dailySpending: number
  includeReceber?: boolean
}): Forecast {
  const kept = events
    .filter((event) => event.data <= until && event.valor !== 0)
    .filter((event) => includeReceber || event.kind !== 'receber')
    .map((event) => ({ ...event, data: event.data < today ? today : event.data }))
    // Por data; no mesmo dia, o que entra antes do que sai (o banco credita de manhã)
    .sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor)

  const total = (kind: ForecastKind) =>
    Math.abs(kept.filter((event) => event.kind === kind).reduce((sum, e) => sum + e.valor, 0))

  let saldo = disponivel
  let menor = { data: today, saldo }
  const timeline = kept.map((event) => {
    saldo += event.valor
    if (saldo < menor.saldo) menor = { data: event.data, saldo }
    return { ...event, saldo }
  })

  const entradas = total('entrada')
  const receber = total('receber')
  const faturas = total('fatura')
  const conta = total('conta')
  const sobra = disponivel + entradas + receber - faturas - conta
  const diaADia = Math.round(Math.max(0, dailySpending) * Math.max(0, daysBetween(today, until)))
  return {
    until,
    disponivel,
    entradas,
    receber,
    faturas,
    conta,
    sobra,
    diaADia,
    sobraComDiaADia: sobra - diaADia,
    timeline,
    menor,
  }
}

/**
 * O que cada pessoa vai te pagar até `until`: o que já venceu (hoje) e a parte dela em cada fatura
 * que vence até lá (no vencimento). Nunca mais do que ela deve ao todo (um pagamento adiantado
 * abate os meses mais próximos primeiro, como em A receber).
 */
export function receivableEvents({
  people,
  months,
  until,
  today,
  name,
}: {
  people: readonly { pessoaId: string; total: number; vencido: number }[]
  months: readonly {
    month: string
    ultimoVencimento: IsoDate
    pessoas: readonly { pessoaId: string; centavos: number }[]
  }[]
  until: IsoDate
  today: IsoDate
  name: (pessoaId: string) => string
}): ForecastEvent[] {
  const events: ForecastEvent[] = []
  for (const person of people) {
    let allowed = Math.max(0, person.total)
    const take = (amount: number) => {
      const value = Math.min(Math.max(0, amount), allowed)
      allowed -= value
      return value
    }
    const late = take(person.vencido)
    if (late > 0)
      events.push({
        data: today,
        kind: 'receber',
        descricao: `${name(person.pessoaId)} (atrasado)`,
        valor: late,
      })
    for (const month of months) {
      if (month.ultimoVencimento > until) continue
      const share = month.pessoas.find((row) => row.pessoaId === person.pessoaId)?.centavos ?? 0
      const value = take(share)
      if (value > 0)
        events.push({
          data: month.ultimoVencimento,
          kind: 'receber',
          descricao: name(person.pessoaId),
          valor: value,
        })
    }
  }
  return events
}

type HistoryRow = {
  tipo: string
  valor_centavos: number
  data: IsoDate
  descricao: string
  pessoa_id: string | null
  compra_id: string | null
  recorrencia_id: string | null
}

export type VariableFilter = {
  history: readonly HistoryRow[]
  /** Compras com mais de uma parcela */
  installmentIds: ReadonlySet<string>
  /** Chaves (descriptionKey) dos gastos fixos */
  fixedKeys: ReadonlySet<string>
  key: (descricao: string) => string
}

/**
 * Quanto saiu no dia a dia entre `from` e `to` (inclusive): os seus gastos que não são fixos (nem
 * recorrentes cadastrados, nem gastos de valor fixo que se repetem) e não são parcelas de compras
 * parceladas.
 */
export function variableSpending(
  { history, installmentIds, fixedKeys, key }: VariableFilter,
  from: IsoDate,
  to: IsoDate,
): number {
  return history
    .filter((row) => row.data >= from && row.data <= to)
    .filter((row) => row.tipo === 'despesa' && !row.pessoa_id && !row.recorrencia_id)
    .filter((row) => !(row.compra_id && installmentIds.has(row.compra_id)))
    .filter((row) => !fixedKeys.has(key(row.descricao)))
    .reduce((sum, row) => sum + row.valor_centavos, 0)
}

/** Gasto do dia a dia por dia, pelos últimos 30 dias (funciona mesmo com pouco histórico). */
export function recentVariableDaily({ today, ...filter }: VariableFilter & { today: IsoDate }) {
  return variableSpending(filter, addDays(today, -29), today) / 30
}
