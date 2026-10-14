import { describe, expect, it } from 'vitest'
import { anonClient, config } from './helpers'

describe('trigger handle_new_user', () => {
  it('cria o perfil com o nome indicado no registo e moeda BRL por omissão', async () => {
    const client = anonClient()
    const email = `perfil-${crypto.randomUUID()}@teste.local`
    const { data, error } = await client.auth.signUp({
      email,
      password: 'senha-de-teste-123',
      options: { data: { nome: '  Ana Silva  ' } },
    })
    expect(error).toBeNull()

    const { data: profile } = await client.from('profiles').select('*').single()
    expect(profile).toMatchObject({ id: data.user!.id, nome: 'Ana Silva', moeda: 'BRL' })
  })

  it('sem nome nos metadados, o perfil fica com nome vazio', async () => {
    const client = anonClient()
    await client.auth.signUp({
      email: `sem-nome-${crypto.randomUUID()}@teste.local`,
      password: 'senha-de-teste-123',
    })
    const { data: profile } = await client.from('profiles').select('nome').single()
    expect(profile?.nome).toBe('')
  })

  it('o servidor recusa senhas com menos de 8 caracteres', async () => {
    const { error } = await anonClient().auth.signUp({
      email: `curta-${crypto.randomUUID()}@teste.local`,
      password: 'curta',
    })
    expect(error?.code).toBe('weak_password')
  })

  it('a função do trigger não pode ser chamada pela API', async () => {
    const response = await fetch(`${config.url}/rest/v1/rpc/handle_new_user`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(response.ok).toBe(false)
  })
})
