import { describe, expect, it } from 'vitest'
import { authErrorMessage, GENERIC_AUTH_ERROR, NETWORK_AUTH_ERROR } from './auth-errors'

describe('authErrorMessage', () => {
  it('sem erro devolve null', () => {
    expect(authErrorMessage(null)).toBeNull()
    expect(authErrorMessage(undefined)).toBeNull()
  })

  it('traduz códigos conhecidos', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe(
      'E-mail ou senha incorretos.',
    )
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/Já existe uma conta/)
  })

  it('reconhece falhas de rede', () => {
    expect(authErrorMessage({ status: 0 })).toBe(NETWORK_AUTH_ERROR)
    expect(authErrorMessage({ name: 'AuthRetryableFetchError' })).toBe(NETWORK_AUTH_ERROR)
  })

  it('usa uma mensagem genérica para erros desconhecidos (sem mostrar texto técnico)', () => {
    expect(authErrorMessage({ code: 'algo_novo', status: 500 })).toBe(GENERIC_AUTH_ERROR)
  })
})
