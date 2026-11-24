import type { IsoDate, MonthKey } from '@/lib/dates'
import { totalsByPerson } from './invoice-summary'

// Próximas faturas, todos os cartões juntos (docs/features/proximas-faturas-todas.md): quanto vai sair
// em cada mês que vem e quanto disso é de quem usa a app e de cada pessoa (T1). Função pura.

type Item = {
  pessoa_id: string | null
  valor_centavos: number
  tipo: string
  compra_id: string | null
  parcela_numero: number | null
}
type Summary<I extends Item> = {
  id: string
  account_id: string
  data_vencimento: IsoDate
  parcelas: I[]
  totalCentavos: number
  pagoCentavos: number
  emAbertoCentavos: number
}

/** Recorrente de um cartão que ainda não aconteceu (features/recurring/projection.ts) */
export type ProjectedCharge = {
  account_id: string
  vencimento: IsoDate
  valor_centavos: number
  descricao: string
  category_id: string
  data: IsoDate
  /** "Só lembrar" (dia ou valor variam) */
  lembrar?: boolean
  atrasado?: boolean
}

/** Linha de um recorrente previsto, ao lado das parcelas de verdade */
export type ProjectedItem = ProjectedCharge & { previsto: true }

export type UpcomingCardMonth<I extends Item> = {
  month: MonthKey
  /** O vencimento mais tardio das faturas deste mês */
  ultimoVencimento: IsoDate
  /** O que falta pagar nas faturas deste mês (= meu + Σ pessoas) */
  total: number
  /** A parte de quem usa a app (o que já pagou adiantado abate aqui) */
  meu: number
  /** A parte de cada pessoa, do maior para o menor */
  pessoas: { pessoaId: string; centavos: number }[]
  /** Quanto do total são recorrentes previstos (ainda não lançados) */
  previsto: number
  /** Por cartão, com as parcelas, os estornos e os recorrentes previstos */
  cartoes: { cardId: string; total: number; items: (I | ProjectedItem)[] }[]
}

/**
 * Faturas que ainda não venceram (vencimento hoje ou depois) com valor por pagar, agrupadas pelo MÊS
 * DO VENCIMENTO. A parte de cada pessoa vem das parcelas dela; o que já foi pago numa fatura futura
 * abate a parte de quem usa a app (é quem paga o cartão). Meses sem nada por pagar não aparecem.
 */
export function upcomingCardMonths<I extends Item>(
  summaries: readonly Summary<I>[],
  today: IsoDate,
  /** Recorrentes previstos (são de quem usa a app: entram na parte "Seu") */
  projected: readonly ProjectedCharge[] = [],
): UpcomingCardMonth<I>[] {
  const months = new Map<MonthKey, UpcomingCardMonth<I>>()
  const monthFor = (vencimento: IsoDate) => {
    const month = vencimento.slice(0, 7)
    let row = months.get(month)
    if (!row) {
      row = {
        month,
        ultimoVencimento: vencimento,
        total: 0,
        meu: 0,
        pessoas: [],
        previsto: 0,
        cartoes: [],
      }
      months.set(month, row)
    }
    if (vencimento > row.ultimoVencimento) row.ultimoVencimento = vencimento
    return row
  }
  const cardOf = (row: UpcomingCardMonth<I>, cardId: string) => {
    let card = row.cartoes.find((item) => item.cardId === cardId)
    if (!card) row.cartoes.push((card = { cardId, total: 0, items: [] }))
    return card
  }
  for (const invoice of summaries) {
    if (invoice.data_vencimento < today || invoice.emAbertoCentavos <= 0) continue
    const row = monthFor(invoice.data_vencimento)
    row.total += invoice.emAbertoCentavos
    for (const { pessoaId, centavos } of totalsByPerson(invoice.parcelas)) {
      if (pessoaId === null) continue
      const person = row.pessoas.find((item) => item.pessoaId === pessoaId)
      if (person) person.centavos += centavos
      else row.pessoas.push({ pessoaId, centavos })
    }
    const card = cardOf(row, invoice.account_id)
    card.total += invoice.emAbertoCentavos
    card.items.push(...invoice.parcelas)
  }
  for (const charge of projected) {
    if (charge.vencimento < today) continue
    const row = monthFor(charge.vencimento)
    row.total += charge.valor_centavos
    row.previsto += charge.valor_centavos
    const card = cardOf(row, charge.account_id)
    card.total += charge.valor_centavos
    card.items.push({ ...charge, previsto: true })
  }
  return [...months.values()]
    .map((row) => {
      const others = row.pessoas.reduce((sum, person) => sum + person.centavos, 0)
      return {
        ...row,
        meu: row.total - others,
        pessoas: row.pessoas.sort((a, b) => b.centavos - a.centavos),
        cartoes: row.cartoes.sort((a, b) => b.total - a.total),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
}
