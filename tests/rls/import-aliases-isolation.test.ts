import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, type TestUser } from './helpers'

// nomes_importacao (migration nomes_importacao): cada um só vê e muda os seus nomes; o upsert da app
// (insert ... on conflict (user_id, chave)) troca o nome sem duplicar.

let a: TestUser
let b: TestUser

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
})

describe('nomes_importacao', () => {
  it('upsert guarda e troca o nome da mesma descrição do banco', async () => {
    const guardar = (descricao: string) =>
      a.client
        .from('nomes_importacao')
        .upsert([{ chave: 'mercadolivre', descricao }], { onConflict: 'user_id,chave' })
    expect((await guardar('Café')).error).toBeNull()
    expect((await guardar('Moedor')).error).toBeNull()
    const { data } = await a.client.from('nomes_importacao').select('chave, descricao')
    expect(data).toEqual([{ chave: 'mercadolivre', descricao: 'Moedor' }])
  })

  it('B não vê, não muda nem apaga os nomes de A; anon não vê nada', async () => {
    expect((await b.client.from('nomes_importacao').select('id')).data).toEqual([])
    await b.client.from('nomes_importacao').update({ descricao: 'X' }).eq('chave', 'mercadolivre')
    await b.client.from('nomes_importacao').delete().eq('chave', 'mercadolivre')
    const { data } = await a.client.from('nomes_importacao').select('descricao')
    expect(data).toEqual([{ descricao: 'Moedor' }])
    const emNomeDeA = await b.client
      .from('nomes_importacao')
      .insert({ user_id: a.id, chave: 'x', descricao: 'Y' } as never)
    expect(emNomeDeA.error).not.toBeNull()
    expect((await anonClient().from('nomes_importacao').select('id')).data ?? []).toEqual([])
  })

  it('nome vazio ou com espaços nas pontas é recusado', async () => {
    const { error } = await a.client
      .from('nomes_importacao')
      .insert({ chave: 'uber', descricao: ' Uber ' })
    expect(error).not.toBeNull()
  })
})
