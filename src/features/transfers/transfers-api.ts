import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Transfer } from '@/lib/finance'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela transferencias (migration transferencias). O pagamento de uma
// fatura é uma transferência para o cartão com fatura_id; as regras e a RLS estão na base de dados.
// A interface para registar pagamentos chega na C6 (página de faturas).

function fail(error: { code?: string; message?: string }): never {
  throw new UserFacingError(dbErrorMessage(error))
}

/** TODAS as transferências (só as colunas dos saldos), para o Início. Paginado com ordem total. */
export async function listTransfers(): Promise<Transfer[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('transferencias')
      .select('conta_origem_id, conta_destino_id, valor_centavos, data')
      .order('data')
      .order('id')
      .range(start, end),
  )
  if (error) fail(error)
  return data
}
