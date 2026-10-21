// Traduz erros do Supabase Auth para mensagens claras em português.
// Usa o `code` estável do erro (não o texto em inglês, que pode mudar).

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'A senha é muito fraca. Use pelo menos 8 caracteres.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  signup_disabled: 'O cadastro de novas contas está desativado.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Aguarde alguns minutos.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  session_not_found: 'Sua sessão expirou. Entre novamente.',
  validation_failed: 'Confira os dados informados.',
}

export const GENERIC_AUTH_ERROR = 'Ocorreu um erro. Tente novamente.'
export const NETWORK_AUTH_ERROR =
  'Sem conexão com o servidor. Verifique sua internet e tente de novo.'

type ErrorLike = { code?: string; status?: number; name?: string } | null | undefined

export function authErrorMessage(error: ErrorLike): string | null {
  if (!error) return null
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]
  // Falha de rede: o supabase-js usa status 0 / AuthRetryableFetchError
  if (error.status === 0 || error.name === 'AuthRetryableFetchError') return NETWORK_AUTH_ERROR
  return GENERIC_AUTH_ERROR
}
