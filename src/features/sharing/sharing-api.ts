import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { IsoDate } from '@/lib/dates'
import type { Movement } from '@/lib/finance'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à partilha da dívida (migration partilhar_divida;
// docs/features/mae-ve-o-que-deve.md). Quem usa a app convida uma pessoa de A receber; quem aceita
// passa a ler, só pela função divida_partilhada, o que essa pessoa deve. Nenhuma tabela do dono é lida
// diretamente por quem está ligado.

const HINT_MESSAGES: Record<string, string> = {
  convite_invalido: 'Este convite não vale mais (já foi usado, foi trocado ou passaram 7 dias).',
  convite_proprio: 'Este convite é seu: envie o link para a pessoa abrir no celular dela.',
  convite_ja_usado: 'Esta pessoa já está ligada a outra conta.',
  convite_pessoa_invalida: 'Esta pessoa já não existe ou está arquivada.',
}

type DbError = { code?: string; message?: string; hint?: string }

function fail(error: DbError): never {
  const message = error.hint ? HINT_MESSAGES[error.hint] : undefined
  throw new UserFacingError(message ?? dbErrorMessage(error))
}

/** Gera um convite (substitui o anterior) e devolve o token, que só existe nesta resposta. */
export async function createInvite(personId: string): Promise<string> {
  const { data, error } = await supabase.rpc('criar_convite_pessoa', { p_pessoa_id: personId })
  if (error) fail(error)
  return data
}

/** Liga a conta da sessão à pessoa do convite. Devolve o id da pessoa. */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('aceitar_convite', { p_token: token })
  if (error) fail(error)
  return data
}

/** Desliga quem lê (pode pedi-lo o dono ou quem está ligado). */
export async function stopSharing(personId: string): Promise<void> {
  const { error } = await supabase.rpc('deixar_de_compartilhar', { p_pessoa_id: personId })
  if (error) fail(error)
}

export type SharedPurchase = {
  id: string
  account_id: string
  category_id: string
  descricao: string
  data_compra: IsoDate
  valor_total_centavos: number
  parcelas: number
  parcela_inicial: number
  pessoa_id: string
}

export type SharedMovement = {
  tipo: Movement['tipo']
  valor_centavos: number
  data: IsoDate
  account_id: string
  fatura_id: string | null
  compra_id: string | null
  pessoa_id: string
}

/** O que uma pessoa deve a uma conta, tal como a base de dados o entrega a quem está ligado. */
export type SharedDebt = {
  pessoaId: string
  pessoaNome: string
  donoNome: string
  dividaAnterior: number
  compras: SharedPurchase[]
  movimentos: SharedMovement[]
  faturas: { id: string; data_vencimento: IsoDate }[]
  cartoes: { id: string; nome: string }[]
  categorias: { id: string; nome: string; cor: string; icone: string }[]
  reembolsos: { id: string; valor_centavos: number; data: IsoDate; descricao: string }[]
}

/** As dívidas partilhadas com a conta da sessão (uma por conta que a convidou). */
export async function listSharedDebts(): Promise<SharedDebt[]> {
  const { data, error } = await supabase.rpc('divida_partilhada')
  if (error) fail(error)
  return data.map((row) => ({
    pessoaId: row.pessoa_id,
    pessoaNome: row.pessoa_nome,
    donoNome: row.dono_nome,
    dividaAnterior: row.divida_anterior_centavos,
    compras: row.compras as SharedPurchase[],
    movimentos: row.movimentos as SharedMovement[],
    faturas: row.faturas as SharedDebt['faturas'],
    cartoes: row.cartoes as SharedDebt['cartoes'],
    categorias: row.categorias as SharedDebt['categorias'],
    reembolsos: row.reembolsos as SharedDebt['reembolsos'],
  }))
}
