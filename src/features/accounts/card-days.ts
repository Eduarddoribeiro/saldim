import type { CardConfig, CardDaysChange } from '@/lib/credit-card'
import { monthOf } from '@/lib/dates'
import type { Account } from './accounts-api'
import type { CardDaysRow } from './card-days-api'

/** Histórico de dias de um cartão, no formato de credit-card.ts. */
export function historyFor(rows: readonly CardDaysRow[], accountId: string): CardDaysChange[] {
  return rows
    .filter((row) => row.account_id === accountId)
    .map((row) => ({
      ateMes: monthOf(row.ate_mes),
      config: { diaFechamento: row.dia_fechamento, diaVencimento: row.dia_vencimento },
    }))
}

/** Dias atuais de um cartão, ou null se a conta não for um cartão configurado. */
export function cardConfig(account: Account | undefined): CardConfig | null {
  return account?.dia_fechamento && account.dia_vencimento
    ? { diaFechamento: account.dia_fechamento, diaVencimento: account.dia_vencimento }
    : null
}
