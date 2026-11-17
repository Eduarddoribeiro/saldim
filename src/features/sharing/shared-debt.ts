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
