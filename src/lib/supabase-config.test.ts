import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabase-config'

const URL = 'http://127.0.0.1:54321'

function jwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.assinatura`
}

describe('readSupabaseConfig', () => {
  it('aceita URL e chave pública', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      }),
    ).toEqual({ url: URL, publishableKey: 'sb_publishable_x' })
  })

  it('falha com mensagem clara quando faltam variáveis', () => {
    expect(() => readSupabaseConfig({})).toThrow(/VITE_SUPABASE_URL/)
    expect(() => readSupabaseConfig({ VITE_SUPABASE_URL: URL })).toThrow(/env:local/)
  })

  it('rejeita URL inválido', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: 'localhost', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toThrow(/inválido/)
  })

  it('recusa chaves secretas no frontend', () => {
    expect(() =>
      readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' }),
    ).toThrow(/SECRETA/)
    expect(() =>
      readSupabaseConfig({
        VITE_SUPABASE_URL: URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }),
      }),
    ).toThrow(/SECRETA/)
  })

  it('aceita a chave anon em formato JWT', () => {
    const anon = jwt({ role: 'anon' })
    expect(
      readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: anon })
        .publishableKey,
    ).toBe(anon)
  })
})
