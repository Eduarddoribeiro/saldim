import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, type TestUser } from './helpers'

let a: TestUser
let b: TestUser
let categoriaDeA: string

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  const { data, error } = await a.client
    .from('categories')
    .insert({ nome: 'Privada de A', tipo: 'despesa' })
    .select('id')
    .single()
  if (error) throw error
  categoriaDeA = data.id
})

describe('categorias iniciais', () => {
  it('cada utilizador novo recebe 9 categorias de despesa e 3 de receita', async () => {
    const { data } = await b.client.from('categories').select('tipo, nome, user_id')
    expect(data?.filter((c) => c.tipo === 'despesa')).toHaveLength(9)
    expect(data?.filter((c) => c.tipo === 'receita')).toHaveLength(3)
    expect(data?.every((c) => c.user_id === b.id)).toBe(true)
  })
})

describe('categories — isolamento', () => {
  it('B não vê categorias de A (nem pelo id)', async () => {
    const todas = await b.client.from('categories').select('user_id')
    expect(todas.data?.every((c) => c.user_id === b.id)).toBe(true)
    const porId = await b.client.from('categories').select('*').eq('id', categoriaDeA)
    expect(porId.data).toEqual([])
  })

  it('B não cria categorias em nome de A', async () => {
    const { error } = await b.client
      .from('categories')
      .insert({ nome: 'Intrusa', tipo: 'despesa', user_id: a.id })
    expect(error?.code).toBe('42501') // WITH CHECK da política de insert
  })

  it('B não altera nem apaga categorias de A', async () => {
    const alterar = await b.client
      .from('categories')
      .update({ nome: 'hackeada' })
      .eq('id', categoriaDeA)
      .select()
    expect(alterar.data).toEqual([])
    const apagar = await b.client.from('categories').delete().eq('id', categoriaDeA).select()
    expect(apagar.data).toEqual([])

    const { data } = await a.client
      .from('categories')
      .select('nome')
      .eq('id', categoriaDeA)
      .single()
    expect(data?.nome).toBe('Privada de A')
  })

  it('sem sessão não há acesso', async () => {
    const { error } = await anonClient().from('categories').select('*')
    expect(error?.code).toBe('42501')
  })
})

describe('categories — regras de dados', () => {
  it('user_id é preenchido automaticamente com o utilizador da sessão', async () => {
    const { data } = await b.client
      .from('categories')
      .insert({ nome: 'Ginásio', tipo: 'despesa', cor: 'violet', icone: 'dumbbell' })
      .select('user_id')
      .single()
    expect(data?.user_id).toBe(b.id)
  })

  it('nome único por tipo, sem distinguir maiúsculas', async () => {
    const duplicado = await b.client.from('categories').insert({ nome: 'moradia', tipo: 'despesa' })
    expect(duplicado.error?.code).toBe('23505')
    // O mesmo nome noutro tipo é permitido
    const outroTipo = await b.client.from('categories').insert({ nome: 'Moradia', tipo: 'receita' })
    expect(outroTipo.error).toBeNull()
  })

  it('o tipo, o dono e a data de criação não podem ser alterados', async () => {
    const { data: cat } = await b.client
      .from('categories')
      .select('id')
      .eq('nome', 'Ginásio')
      .single()
    for (const patch of [
      { tipo: 'receita' as const },
      { user_id: a.id },
      { created_at: '2000-01-01' },
    ]) {
      const { error } = await b.client.from('categories').update(patch).eq('id', cat!.id)
      expect(error?.code).toBe('42501')
    }
  })

  it.each([
    ['nome vazio', { nome: '' }],
    ['nome com espaços nas pontas', { nome: ' Café ' }],
    ['nome com mais de 40 caracteres', { nome: 'x'.repeat(41) }],
    ['cor fora da paleta', { nome: 'Cor má', cor: 'fucsia' }],
    ['ícone com formato inválido', { nome: 'Ícone mau', icone: 'Not Valid!' }],
  ])('recusa %s', async (_caso, valores) => {
    const { error } = await b.client.from('categories').insert({ tipo: 'despesa', ...valores })
    expect(error?.code).toBe('23514')
  })

  it('o próprio pode arquivar, editar e apagar as suas', async () => {
    const { data: cat } = await b.client
      .from('categories')
      .insert({ nome: 'Temporária', tipo: 'despesa' })
      .select('id')
      .single()
    const editar = await b.client
      .from('categories')
      .update({ nome: 'Temporária 2', arquivada: true, cor: 'red' })
      .eq('id', cat!.id)
      .select('nome, arquivada, cor')
      .single()
    expect(editar.data).toEqual({ nome: 'Temporária 2', arquivada: true, cor: 'red' })
    const apagar = await b.client.from('categories').delete().eq('id', cat!.id).select('id')
    expect(apagar.data).toHaveLength(1)
  })
})
