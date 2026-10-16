import type { InvoiceState } from '@/lib/credit-card'
import { formatMonth, type IsoDate } from '@/lib/dates'

// Rótulos e cores dos estados das faturas. Record<InvoiceState, …>: um estado novo obriga a tratá-lo.
export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  vencida: 'Vencida',
  paga: 'Paga',
  com_credito: 'Com crédito',
  sem_compras: 'Sem compras',
}

// Cores com contraste suficiente nos dois temas; o texto do estado está sempre escrito (a cor não é
// a única pista).
export const INVOICE_STATE_CLASSES: Record<InvoiceState, string> = {
  aberta: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  fechada: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  vencida: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  paga: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  com_credito: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  sem_compras: 'bg-muted text-muted-foreground',
}

/** 'Fatura de dezembro de 2026' (mes_referencia = 1.º dia do mês do vencimento) */
export function invoiceTitle(mesReferencia: IsoDate): string {
  return `Fatura de ${formatMonth(mesReferencia.slice(0, 7))}`
}

/** 'Dezembro de 2026' (título curto, para as linhas da lista) */
export function invoiceMonth(mesReferencia: IsoDate): string {
  const month = formatMonth(mesReferencia.slice(0, 7))
  return month.charAt(0).toUpperCase() + month.slice(1)
}

/** '05/12' */
export function dayMonth(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

/** '05/12/2026' */
export function shortDate(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
