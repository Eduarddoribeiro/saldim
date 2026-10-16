import { invoiceStatus, type InvoiceState } from '@/lib/credit-card'
import type { IsoDate } from '@/lib/dates'

// Totais e estado de cada fatura, calculados a partir das parcelas e dos pagamentos (o estado nunca é
// guardado, para nunca ficar desatualizado). Função pura: os testes não precisam de base de dados.

type InvoiceLike = { id: string; data_fechamento: IsoDate; data_vencimento: IsoDate }
type ItemLike = { fatura_id: string | null; valor_centavos: number }
type PaymentLike = { fatura_id: string | null; valor_centavos: number }

export type InvoiceSummary<I, P, Pay> = I & {
  parcelas: P[]
  pagamentos: Pay[]
  /** Σ parcelas */
  totalCentavos: number
  /** Σ pagamentos */
  pagoCentavos: number
  /** total − pago; negativo = crédito a favor */
  emAbertoCentavos: number
  estado: InvoiceState
}

export function summarizeInvoices<
  I extends InvoiceLike,
  P extends ItemLike,
  Pay extends PaymentLike,
>(invoices: I[], items: P[], payments: Pay[], hoje: IsoDate): InvoiceSummary<I, P, Pay>[] {
  const itemsByInvoice = groupBy(items)
  const paymentsByInvoice = groupBy(payments)
  return invoices.map((invoice) => {
    const parcelas = itemsByInvoice.get(invoice.id) ?? []
    const pagamentos = paymentsByInvoice.get(invoice.id) ?? []
    const totalCentavos = sum(parcelas)
    const pagoCentavos = sum(pagamentos)
    const { estado, emAbertoCentavos } = invoiceStatus(
      {
        fechamento: invoice.data_fechamento,
        vencimento: invoice.data_vencimento,
        totalCentavos,
        pagoCentavos,
      },
      hoje,
    )
    return {
      ...invoice,
      parcelas,
      pagamentos,
      totalCentavos,
      pagoCentavos,
      emAbertoCentavos,
      estado,
    }
  })
}

/** Por pagar = ainda há dinheiro em aberto numa fatura que já tem compras (inclui a aberta atual). */
export const isToPay = (summary: { estado: InvoiceState; emAbertoCentavos: number }) =>
  (summary.estado === 'aberta' || summary.estado === 'fechada' || summary.estado === 'vencida') &&
  summary.emAbertoCentavos > 0

function groupBy<T extends { fatura_id: string | null }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    if (!row.fatura_id) continue
    const group = groups.get(row.fatura_id)
    if (group) group.push(row)
    else groups.set(row.fatura_id, [row])
  }
  return groups
}

const sum = (rows: { valor_centavos: number }[]) =>
  rows.reduce((total, row) => total + row.valor_centavos, 0)
