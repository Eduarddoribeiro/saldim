import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, type TestUser } from './helpers'

// Isolamento da tabela profiles: B nunca vê nem altera o perfil de A.

let a: TestUser
let b: TestUser

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  const { error } = await a.client.from('profiles').update({ nome: 'Perfil de A' }).eq('id', a.id)
  if (error) throw error
})

describe('profiles — leitura', () => {
  it('cada utilizador vê exatamente o seu perfil', async () => {
    const { data, error } = await b.client.from('profiles').select('id')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: b.id }])
  })

  it('B não encontra o perfil de A mesmo sabendo o id', async () => {
    const { data } = await b.client.from('profiles').select('*').eq('id', a.id)
    expect(data).toEqual([])
  })

  it('sem sessão (anon) não há acesso', async () => {
    const { data, error } = await anonClient().from('profiles').select('*')
    // Privilégios revogados: o Postgres recusa o pedido em vez de devolver linhas
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })
})

describe('profiles — escrita', () => {
  it('B não altera o perfil de A (0 linhas afetadas) e os dados de A ficam intactos', async () => {
    const { data } = await b.client
      .from('profiles')
      .update({ nome: 'hackeado' })
      .eq('id', a.id)
      .select()
    expect(data).toEqual([])

    const { data: perfilA } = await a.client.from('profiles').select('nome').single()
    expect(perfilA?.nome).toBe('Perfil de A')
  })

  it('B não consegue mudar o id do seu perfil para o de A', async () => {
    const { error } = await b.client.from('profiles').update({ id: a.id }).eq('id', b.id)
    expect(error?.code).toBe('42501') // coluna id sem permissão de update
  })

  it('B não consegue alterar created_at', async () => {
    const { error } = await b.client
      .from('profiles')
      .update({ created_at: '2000-01-01T00:00:00Z' })
      .eq('id', b.id)
    expect(error?.code).toBe('42501')
  })

  it('ninguém cria perfis diretamente (nem para si, nem para outro)', async () => {
    const paraA = await b.client.from('profiles').insert({ id: a.id, nome: 'falso' })
    expect(paraA.error).not.toBeNull()
    const paraSi = await b.client.from('profiles').insert({ id: b.id, nome: 'duplicado' })
    expect(paraSi.error).not.toBeNull()
  })

  it('B não apaga o perfil de A nem o seu (sem política de delete)', async () => {
    const deA = await b.client.from('profiles').delete().eq('id', a.id).select()
    expect(deA.data ?? []).toEqual([])
    const proprio = await b.client.from('profiles').delete().eq('id', b.id).select()
    expect(proprio.data ?? []).toEqual([])

    const { data } = await a.client.from('profiles').select('id')
    expect(data).toEqual([{ id: a.id }])
  })

  it('o próprio utilizador altera o seu nome e moeda', async () => {
    const { data, error } = await b.client
      .from('profiles')
      .update({ nome: 'Bruno', moeda: 'EUR' })
      .eq('id', b.id)
      .select('nome, moeda')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ nome: 'Bruno', moeda: 'EUR' })
  })

  it('a base de dados recusa moedas não suportadas', async () => {
    const { error } = await b.client.from('profiles').update({ moeda: 'XYZ' }).eq('id', b.id)
    expect(error?.code).toBe('23514') // violação de CHECK
  })
})
