import type { IsoDate } from '@/lib/dates'
import { receivables } from '@/lib/finance'
import type { SharedDebt } from './sharing-api'

/**
 * Quanto a pessoa deve, já vencido e em faturas futuras: as MESMAS contas de A receber
 * (`receivables`), feitas com os dados que a função divida_partilhada entrega a quem está ligado.
 */
export function summarizeSharedDebt(debt: SharedDebt, today: IsoDate) {
  const due = new Set(
    debt.faturas.filter((invoice) => invoice.data_vencimento <= today).map((invoice) => invoice.id),
  )
  const [row] = receivables(
    debt.movimentos,
    debt.reembolsos.map((item) => ({
      pessoa_id: debt.pessoaId,
      valor_centavos: item.valor_centavos,
    })),
    due,
    [{ id: debt.pessoaId, divida_anterior_centavos: debt.dividaAnterior }],
  )
  const total = row?.total ?? 0
  const vencido = row?.vencido ?? 0
  return { total, vencido, futuro: Math.max(total - vencido, 0) }
}

/** Como se chama quem convidou: o nome do perfil, ou uma descrição quando não tem nome. */
export function ownerLabel(debt: Pick<SharedDebt, 'donoNome'>): string {
  return debt.donoNome.trim() || 'quem te emprestou o cartão'
}

/** Onde a pessoa gastou: o total das compras dela por categoria, da maior para a menor. */
export function sharedSpendingByCategory(debt: Pick<SharedDebt, 'compras'>) {
  const byCategory = new Map<string, { total: number; nomes: string[] }>()
  for (const purchase of debt.compras) {
    const row = byCategory.get(purchase.category_id) ?? { total: 0, nomes: [] }
    row.total += purchase.valor_total_centavos
    if (purchase.descricao && !row.nomes.includes(purchase.descricao))
      row.nomes.push(purchase.descricao)
    byCategory.set(purchase.category_id, row)
  }
  const total = [...byCategory.values()].reduce((sum, row) => sum + row.total, 0)
  return [...byCategory]
    .map(([categoryId, row]) => ({
      categoryId,
      total: row.total,
      share: total > 0 ? row.total / total : 0,
      nomes: row.nomes,
    }))
    .sort((a, b) => b.total - a.total)
}
