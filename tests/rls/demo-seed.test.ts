import { describe, expect, it } from 'vitest'
import { seedDemoData } from '../../src/features/demo/demo-seed'
import { anonClient, createTestUser } from './helpers'

// Demo pública (docs/features/demo-publica.md): cada visitante entra com uma conta anónima e os dados
// inventados entram nela pelas mesmas regras (RLS, triggers, RPCs) que a app usa.

describe('demo pública', () => {
  it('uma conta anónima recebe os dados da demo, e só ela os vê', async () => {
    const visitante = anonClient()
    const { data, error } = await visitante.auth.signInAnonymously({
      options: { data: { nome: 'Marina' } },
    })
    expect(error).toBeNull()
    expect(data.user?.is_anonymous).toBe(true)

    await seedDemoData(visitante, new Date())

    const contar = async (tabela: 'accounts' | 'transactions' | 'compras_cartao' | 'budgets') =>
      (await visitante.from(tabela).select('id', { count: 'exact', head: true })).count ?? 0
    expect(await contar('accounts')).toBe(4)
    expect(await contar('compras_cartao')).toBeGreaterThan(20)
    expect(await contar('transactions')).toBeGreaterThan(100)
    expect(await contar('budgets')).toBe(8)
    const { data: perfil } = await visitante.from('profiles').select('nome').single()
    expect(perfil?.nome).toBe('Marina')

    // Outro visitante (ou utilizador) não vê nada disto
    const outro = await createTestUser('outro')
    const { data: alheias } = await outro.client
      .from('transactions')
      .select('id')
      .eq('user_id', data.user!.id)
    expect(alheias).toEqual([])
  })
})
