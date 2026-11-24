import { beforeAll, describe, expect, it } from 'vitest'
import { createTestUser, type TestUser } from './helpers'

// Recorrentes "só lembrar" (migration recorrentes_lembrar): gerar_recorrencias nunca os lança, só
// avança a próxima data (que assim não fica no passado); os automáticos continuam como sempre.

let a: TestUser
let conta: string
let despesa: string

const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

beforeAll(async () => {
  a = await createTestUser('lembrar')
  const [{ data: c }, { data: d }] = await Promise.all([
    a.client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    a.client.from('categories').select('id').eq('nome', 'Lazer').single(),
  ])
  conta = c!.id
  despesa = d!.id
})

describe('recorrentes só lembrar', () => {
  it('não são lançados; os automáticos sim', async () => {
    const hoje = hojeLocal()
    const dia = Number(hoje.slice(8, 10))
    const criar = (descricao: string, modo: 'automatico' | 'lembrar') =>
      a.client
        .from('recorrencias')
        .insert({
          account_id: conta,
          category_id: despesa,
          tipo: 'despesa',
          valor_centavos: 5000,
          descricao,
          frequencia: 'mensal',
          dia,
          proxima_data: hoje,
          modo,
        })
        .select('id')
        .single()
    const { data: corte, error } = await criar('Corte de cabelo', 'lembrar')
    expect(error).toBeNull()
    await criar('Netflix', 'automatico')

    const { error: genError } = await a.client.rpc('gerar_recorrencias', { p_hoje: hoje })
    expect(genError).toBeNull()

    const { data: lancados } = await a.client.from('transactions').select('descricao')
    expect(lancados?.map((t) => t.descricao)).toEqual(['Netflix'])
    // A próxima data do "só lembrar" avançou para o mês seguinte
    const { data: depois } = await a.client
      .from('recorrencias')
      .select('proxima_data')
      .eq('id', corte!.id)
      .single()
    expect(depois!.proxima_data > hoje).toBe(true)
  })

  it('modo desconhecido é recusado', async () => {
    const { error } = await a.client.from('recorrencias').insert({
      account_id: conta,
      category_id: despesa,
      tipo: 'despesa',
      valor_centavos: 100,
      descricao: 'X',
      frequencia: 'mensal',
      dia: 1,
      proxima_data: '2099-01-01',
      modo: 'outro',
    })
    expect(error).not.toBeNull()
  })
})
