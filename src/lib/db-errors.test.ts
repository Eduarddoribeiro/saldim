import { describe, expect, it } from 'vitest'
import {
  dbErrorMessage,
  errorMessage,
  GENERIC_DB_ERROR,
  NETWORK_DB_ERROR,
  UserFacingError,
} from './db-errors'

describe('dbErrorMessage', () => {
  it('traduz códigos do Postgres e do PostgREST', () => {
    expect(dbErrorMessage({ code: '23503' })).toMatch(/em uso/)
    expect(dbErrorMessage({ code: '42501' })).toMatch(/permissão/)
    expect(dbErrorMessage({ code: 'PGRST116' })).toBe('Registro não encontrado.')
  })

  it('aceita mensagens específicas por ecrã', () => {
    expect(
      dbErrorMessage({ code: '23505' }, { '23505': 'Já existe uma categoria com esse nome.' }),
    ).toBe('Já existe uma categoria com esse nome.')
  })

  it('reconhece falhas de rede', () => {
    expect(dbErrorMessage({ message: 'TypeError: Failed to fetch' })).toBe(NETWORK_DB_ERROR)
  })

  it('nunca mostra o texto técnico de erros desconhecidos', () => {
    expect(dbErrorMessage({ code: 'XX000', message: 'internal error at line 3' })).toBe(
      GENERIC_DB_ERROR,
    )
    expect(dbErrorMessage(null)).toBe(GENERIC_DB_ERROR)
  })
})

describe('errorMessage', () => {
  it('usa a mensagem de UserFacingError e esconde as outras', () => {
    expect(errorMessage(new UserFacingError('Mensagem clara.'))).toBe('Mensagem clara.')
    expect(errorMessage(new Error('stack trace técnico'))).toBe(GENERIC_DB_ERROR)
  })
})
