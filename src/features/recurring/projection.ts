import { invoiceDates, invoiceForPurchase, type CardConfig } from '@/lib/credit-card'
import { descriptionKey } from '@/features/import/suggest'
import { addDays, addMonths, type IsoDate } from '@/lib/dates'
import { dayInMonth, occurrencesUntil, type Frequency } from '@/lib/recurrence'

// Recorrentes previstos (pedido de 2026-11-23: "se a conta é recorrente, é um gasto previsto"): as
// próximas ocorrências das recorrências ativas, depois de hoje, só para MOSTRAR (faturas futuras,
// bloco Previsto do Extrato, saldo previsto). Nunca se gravam: no dia, gerar_recorrencias lança o
// real e a ocorrência deixa de ser "depois de hoje", por isso não há duplicados.

type Recurrence = {
  id: string
  account_id: string
  category_id: string
  tipo: string
  valor_centavos: number
  descricao: string
  frequencia: Frequency
  dia: number
  proxima_data: IsoDate
  ativa: boolean
  /** automatico: a app lança no dia; lembrar: só previsto até haver no mês um lançamento com o nome */
  modo?: string
  created_at?: string
}

/** Lançamentos já feitos (para saber se um "só lembrar" já foi pago no mês e o último valor) */
type Paid = { descricao: string; tipo: string; valor_centavos: number; data: IsoDate }

export type ProjectedOccurrence = {
  recurrenceId: string
  data: IsoDate
  account_id: string
  category_id: string
  tipo: 'despesa' | 'receita'
  valor_centavos: number
  descricao: string
  /** "Só lembrar": não é lançado sozinho; some quando houver no mês um lançamento com o nome */
  lembrar: boolean
  /** "Só lembrar" cujo dia provável deste mês já passou sem pagamento */
  atrasado: boolean
}

/** Ocorrências das recorrências ativas com data depois de hoje e até `until` (inclusive). */
export function projectRecurring(
  recurrences: readonly Recurrence[],
  today: IsoDate,
  until: IsoDate,
  history: readonly Paid[] = [],
): ProjectedOccurrence[] {
  const base = (recurrence: Recurrence) => ({
    recurrenceId: recurrence.id,
    account_id: recurrence.account_id,
    category_id: recurrence.category_id,
    tipo: recurrence.tipo === 'receita' ? ('receita' as const) : ('despesa' as const),
    descricao: recurrence.descricao,
  })
  return recurrences
    .filter((recurrence) => recurrence.ativa)
    .flatMap((recurrence) => {
      if (recurrence.modo === 'lembrar') return remindOnly(recurrence, today, until, history, base)
      return occurrencesUntil(recurrence.proxima_data, recurrence.frequencia, recurrence.dia, until)
        .filter((data) => data > today)
        .map((data) => ({
          ...base(recurrence),
          data,
          valor_centavos: recurrence.valor_centavos,
          lembrar: false,
          atrasado: false,
        }))
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.recurrenceId.localeCompare(b.recurrenceId))
}

/**
 * "Só lembrar": um previsto por mês (ou por ano) enquanto não houver um lançamento com o mesmo nome
 * nesse período. O valor é o do último pagamento com esse nome (ex.: assinatura em dólar), ou o
 * aproximado. Se o dia provável deste mês já passou sem pagamento, fica para amanhã, "atrasado".
 */
function remindOnly(
  recurrence: Recurrence,
  today: IsoDate,
  until: IsoDate,
  history: readonly Paid[],
  base: (
    r: Recurrence,
  ) => Omit<ProjectedOccurrence, 'data' | 'valor_centavos' | 'lembrar' | 'atrasado'>,
): ProjectedOccurrence[] {
  const key = descriptionKey(recurrence.descricao)
  const tipo = recurrence.tipo === 'receita' ? 'receita' : 'despesa'
  const payments = key
    ? history.filter((item) => item.tipo === tipo && descriptionKey(item.descricao) === key)
    : []
  const last = payments.reduce<Paid | null>(
    (latest, item) => (!latest || item.data > latest.data ? item : latest),
    null,
  )
  const valor = last?.valor_centavos ?? recurrence.valor_centavos
  const anual = recurrence.frequencia === 'anual'
  const periodOf = (date: IsoDate) => (anual ? date.slice(0, 4) : date.slice(0, 7))
  const paidPeriods = new Set(payments.map((item) => periodOf(item.data)))
  const createdMonth = (recurrence.created_at ?? '').slice(0, 7)
  const tomorrow = addDays(today, 1)
  const occurrences: ProjectedOccurrence[] = []
  for (let month = today.slice(0, 7); month <= until.slice(0, 7); month = addMonths(month, 1)) {
    // Anual: só no mês do ano em que cai
    if (anual && month.slice(5, 7) !== recurrence.proxima_data.slice(5, 7)) continue
    if (createdMonth && month < createdMonth) continue
    const date = dayInMonth(month, recurrence.dia)
    if (date > until || paidPeriods.has(periodOf(date))) continue
    const atrasado = date <= today
    occurrences.push({
      ...base(recurrence),
      data: atrasado ? tomorrow : date,
      valor_centavos: valor,
      lembrar: true,
      atrasado,
    })
  }
  return occurrences
}

/**
 * A fatura em que cada recorrente de um cartão vai cair (os dias atuais do cartão: as faturas
 * futuras usam-nos). Só despesas em cartões com fecho e vencimento.
 */
export function projectedCardCharges(
  occurrences: readonly ProjectedOccurrence[],
  cards: readonly { id: string; dia_fechamento: number | null; dia_vencimento: number | null }[],
): (ProjectedOccurrence & { vencimento: IsoDate })[] {
  const configs = new Map<string, CardConfig>()
  for (const card of cards) {
    if (card.dia_fechamento && card.dia_vencimento) {
      configs.set(card.id, {
        diaFechamento: card.dia_fechamento,
        diaVencimento: card.dia_vencimento,
      })
    }
  }
  return occurrences.flatMap((occurrence) => {
    const config = configs.get(occurrence.account_id)
    if (!config || occurrence.tipo !== 'despesa') return []
    const mes = invoiceForPurchase(config, occurrence.data)
    return [{ ...occurrence, vencimento: invoiceDates(config, mes).vencimento }]
  })
}

/**
 * Os previstos que contam para um saldo futuro: uma entrada "só lembrar" cujo dia já passou fica de
 * fora (pode já ter caído com outro nome, e o previsto não deve ser mais otimista do que a
 * realidade); uma saída atrasada continua a contar, por segurança.
 */
export function forBalance<T extends Pick<ProjectedOccurrence, 'atrasado' | 'tipo'>>(
  occurrences: readonly T[],
): T[] {
  return occurrences.filter((occurrence) => !(occurrence.atrasado && occurrence.tipo === 'receita'))
}
