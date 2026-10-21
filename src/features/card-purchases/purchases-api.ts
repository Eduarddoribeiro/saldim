import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'
import type { PurchaseFormValues } from './schemas'

// Único ponto de acesso às compras no cartão. Uma compra regista-se SEMPRE com a função
// registar_compra_cartao (compra + faturas + parcelas numa só transação); as regras e a RLS estão na
// base de dados (migration faturas_compras) e valem também para quem escreve diretamente.
// Os estornos (C8) registam-se com registar_estorno_cartao e são transações do tipo `estorno`.

export type CardPurchase = Tables<'compras_cartao'>

/** Estorno de uma compra: crédito no cartão, na fatura da data do estorno (D11). */
export type Refund = Pick<
  Tables<'transactions'>,
  'id' | 'compra_id' | 'fatura_id' | 'valor_centavos' | 'data' | 'descricao'
>

export type RefundValues = { compraId: string; valor: number; data: string; descricao: string }

const MESSAGES = {
  '23503': 'O cartão ou a categoria escolhida já não existe. Atualize a página e tente de novo.',
  '23514': 'Há um valor inválido (confira o valor, as parcelas e a data).',
}

// Regras com nome (CHECK ou HINT das triggers): mensagem própria. O nome aparece no texto técnico.
const RULE_MESSAGES: Record<string, string> = {
  compras_cartao_conta_check: 'Escolha um cartão de crédito.',
  compras_cartao_categoria_check: 'Uma compra no cartão precisa usar uma categoria de despesa.',
  compras_cartao_valor_check: 'O valor precisa chegar para todas as parcelas (1 centavo cada).',
  compras_cartao_parcelas_check: 'O número de parcelas não é válido.',
  // D6 (migration transferencias): o histórico pago não se apaga; corrige-se com um estorno
  compras_cartao_fatura_paga_check:
    'Esta compra tem parcelas ou estornos em faturas com pagamentos, por isso não pode ser excluída. Para corrigir, registre um estorno.',
  // Estornos (migration estornos_dias_cartao)
  transactions_estorno_valor_check: 'Os estornos desta compra não podem passar do valor da compra.',
  transactions_estorno_futuro_check: 'Um estorno não pode ter data futura.',
  transactions_estorno_data_check: 'O estorno não pode ser anterior à data da compra.',
  transactions_estorno_fatura_paga_check:
    'Este estorno está em uma fatura com pagamentos, por isso não pode ser excluído.',
  compras_cartao_pessoa_fk: 'A pessoa escolhida já não existe. Atualize a página e tente de novo.',
  transactions_estorno_compra_check:
    'Esta compra já não existe. Atualize a página e tente de novo.',
  faturas_mes_check: 'As parcelas passariam do ano 2999. Confira a data da compra.',
  faturas_datas_check: 'As parcelas passariam do ano 2999. Confira a data da compra.',
}

type DbError = { code?: string; message?: string; details?: string; hint?: string }

function fail(error: DbError): never {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  const rule = Object.keys(RULE_MESSAGES).find((name) => text.includes(name))
  throw new UserFacingError(rule ? RULE_MESSAGES[rule] : dbErrorMessage(error, MESSAGES))
}

/** Todas as compras (para mostrar "parcela k/n" e o detalhe); paginado com ordem total. */
export async function listPurchases(): Promise<CardPurchase[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('compras_cartao')
      .select('*')
      .order('data_compra', { ascending: false })
      .order('id')
      .range(start, end),
  )
  if (error) fail(error)
  return data
}

/** Regista a compra e as parcelas; devolve o id da compra. */
export async function registerPurchase(values: PurchaseFormValues): Promise<string> {
  const { data, error } = await supabase.rpc('registar_compra_cartao', {
    p_account_id: values.cardId,
    p_category_id: values.categoryId,
    p_data_compra: values.data,
    p_valor_total_centavos: values.valor,
    p_parcelas: values.parcelas,
    p_parcela_inicial: values.parcelaInicial,
    p_descricao: values.descricao,
    // T1: compra de outra pessoa ('' = minha). NEW_PERSON já foi trocado pelo id no formulário.
    ...(values.pessoaId ? { p_pessoa_id: values.pessoaId } : {}),
  })
  if (error) fail(error)
  return data
}

/** Todos os estornos do utilizador (poucos), para o detalhe das compras. */
export async function listRefunds(): Promise<Refund[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('transactions')
      .select('id, compra_id, fatura_id, valor_centavos, data, descricao')
      .eq('tipo', 'estorno')
      .order('data')
      .order('id')
      .range(start, end),
  )
  if (error) fail(error)
  return data
}

/** Regista um estorno (e a fatura da sua data, se faltar); devolve o id do estorno. */
export async function registerRefund(values: RefundValues): Promise<string> {
  const { data, error } = await supabase.rpc('registar_estorno_cartao', {
    p_compra_id: values.compraId,
    p_data: values.data,
    p_valor_centavos: values.valor,
    p_descricao: values.descricao,
  })
  if (error) fail(error)
  return data
}

/** Apaga um estorno (é a forma de o corrigir), se a fatura ainda não tiver pagamentos. */
export async function deleteRefund(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) fail(error)
}

/** Apaga a compra; as parcelas vão com ela (cascata na base de dados). */
export async function deletePurchase(id: string): Promise<void> {
  const { error } = await supabase.from('compras_cartao').delete().eq('id', id)
  if (error) fail(error)
}
