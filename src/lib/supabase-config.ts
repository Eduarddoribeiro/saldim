export type SupabaseConfig = { url: string; publishableKey: string }

/**
 * Valida a configuração pública do Supabase. Falha cedo, com uma mensagem clara,
 * em vez de a app arrancar e dar erros estranhos nos pedidos.
 */
export function readSupabaseConfig(env: Record<string, string | undefined>): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new Error(
      'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY. ' +
        'Em desenvolvimento: npm run db:start && npm run env:local (ver .env.example).',
    )
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`VITE_SUPABASE_URL inválido: "${url}"`)
  }
  // Proteção contra o erro mais perigoso: pôr a chave secreta no frontend.
  if (publishableKey.startsWith('sb_secret_') || isServiceRoleJwt(publishableKey)) {
    throw new Error('A chave em VITE_SUPABASE_PUBLISHABLE_KEY é SECRETA. Usa a chave pública.')
  }
  return { url, publishableKey }
}

function isServiceRoleJwt(key: string): boolean {
  const payload = key.split('.')[1]
  if (!payload) return false
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'
  } catch {
    return false
  }
}
