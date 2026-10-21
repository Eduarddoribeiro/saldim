import { describe, expect, it } from 'vitest'
import { loginSchema, resetPasswordSchema, signUpSchema } from './schemas'

describe('signUpSchema', () => {
  const valid = {
    nome: '  Ana  ',
    email: ' ana@exemplo.pt ',
    password: 'segredo123',
    confirmPassword: 'segredo123',
  }

  const firstIssue = (input: unknown) => signUpSchema.safeParse(input).error?.issues[0]

  it('aceita dados válidos e remove espaços do nome e do e-mail', () => {
    expect(signUpSchema.parse(valid)).toMatchObject({ nome: 'Ana', email: 'ana@exemplo.pt' })
  })

  it('exige senha com pelo menos 8 caracteres', () => {
    expect(firstIssue({ ...valid, password: 'curta', confirmPassword: 'curta' })?.message).toMatch(
      /pelo menos 8/,
    )
  })

  it('recusa senhas com mais de 72 caracteres', () => {
    const longa = 'a'.repeat(73)
    expect(
      signUpSchema.safeParse({ ...valid, password: longa, confirmPassword: longa }).success,
    ).toBe(false)
  })

  it('aponta o erro para a confirmação quando as senhas não coincidem', () => {
    const issue = firstIssue({ ...valid, confirmPassword: 'outra-coisa' })
    expect(issue?.message).toBe('As senhas não coincidem.')
    expect(issue?.path).toEqual(['confirmPassword'])
  })

  it('recusa e-mail inválido e nome vazio', () => {
    expect(firstIssue({ ...valid, email: 'ana@' })?.message).toBe('E-mail inválido.')
    expect(firstIssue({ ...valid, nome: '   ' })?.message).toBe('Informe seu nome.')
  })
})

describe('loginSchema', () => {
  it('não aplica o mínimo de 8 caracteres no login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.pt', password: 'x' }).success).toBe(true)
  })

  it('exige e-mail e senha', () => {
    const result = loginSchema.safeParse({ email: '', password: '' })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Informe seu e-mail.',
      'Informe a senha.',
    ])
  })
})

describe('resetPasswordSchema', () => {
  it('exige confirmação igual', () => {
    const ok = { password: 'novasenha1', confirmPassword: 'novasenha1' }
    expect(resetPasswordSchema.safeParse(ok).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ ...ok, confirmPassword: 'novasenha2' }).success).toBe(
      false,
    )
  })
})
