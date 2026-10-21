// Traduz erros da API do Supabase (PostgREST / Postgres) para mensagens em português.
// Usa o `code` (SQLSTATE do Postgres ou PGRSTxxx do PostgREST), nunca o texto técnico em inglês.

type ErrorLike = { code?: string; message?: string; name?: string } | null | undefined

const DEFAULT_MESSAGES: Record<string, string> = {
  '23505': 'Já existe um registro com esses dados.', // unique_violation
  '23503': 'Este registro está em uso e não pode ser excluído.', // foreign_key_violation
  '23514': 'Há um valor inválido.', // check_violation
  '23502': 'Falta preencher um campo obrigatório.', // not_null_violation
  '22001': 'Um dos textos é longo demais.', // string_data_right_truncation
  '42501': 'Você não tem permissão para esta operação.', // insufficient_privilege (inclui RLS)
  PGRST116: 'Registro não encontrado.', // .single() sem linhas (também quando a RLS o esconde)
  PGRST301: 'Sua sessão expirou. Entre novamente.', // JWT expirado
}

export const GENERIC_DB_ERROR = 'Ocorreu um erro. Tente novamente.'
export const NETWORK_DB_ERROR =
  'Sem conexão com o servidor. Verifique sua internet e tente de novo.'

/** `overrides` permite mensagens mais específicas por ecrã (ex.: 23505 → "Já existe uma categoria…"). */
export function dbErrorMessage(error: ErrorLike, overrides: Record<string, string> = {}): string {
  if (!error) return GENERIC_DB_ERROR
  const code = error.code ?? ''
  if (overrides[code]) return overrides[code]
  if (DEFAULT_MESSAGES[code]) return DEFAULT_MESSAGES[code]
  if (/failed to fetch|network|load failed/i.test(error.message ?? '')) return NETWORK_DB_ERROR
  return GENERIC_DB_ERROR
}

/** Erro com mensagem já pronta a mostrar; as funções de acesso a dados lançam este tipo. */
export class UserFacingError extends Error {
  override name = 'UserFacingError'
}

/** Mensagem a mostrar para qualquer erro apanhado pela interface. */
export function errorMessage(error: unknown): string {
  return error instanceof UserFacingError ? error.message : GENERIC_DB_ERROR
}
