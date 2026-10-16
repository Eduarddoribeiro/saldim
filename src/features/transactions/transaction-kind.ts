import type { Transaction } from './transactions-api'

/** Receita ou despesa normal (não é parcela nem estorno de uma compra no cartão): edita-se no formulário. */
export type PlainTransaction = Transaction & { tipo: 'receita' | 'despesa'; compra_id: null }

export function isPlainTransaction(transaction: Transaction): transaction is PlainTransaction {
  return transaction.compra_id === null && transaction.tipo !== 'estorno'
}
