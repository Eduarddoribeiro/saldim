import { describe, expect, it } from 'vitest'
import { anonClient, config, createTestUser } from './helpers'

describe('ligação ao Supabase local', () => {
  it('o serviço de autenticação responde', async () => {
    const response = await fetch(`${config.url}/auth/v1/health`, {
      headers: { apikey: config.publishableKey },
    })
    expect(response.ok).toBe(true)
  })

  it('o cliente sem sessão não tem utilizador', async () => {
    const { data } = await anonClient().auth.getSession()
    expect(data.session).toBeNull()
  })

  it('consegue registar um utilizador e obter sessão', async () => {
    const user = await createTestUser('ligacao')
    const { data } = await user.client.auth.getUser()
    expect(data.user?.id).toBe(user.id)
  })
})
