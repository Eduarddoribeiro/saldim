import { beforeAll, describe, expect, it } from 'vitest'
import type { IsoDate } from '../../src/lib/dates'
import { anonClient, createTestUser, withLocalDb, type TestUser } from './helpers'

// A pessoa vê o que deve, na conta dela (migration partilhar_divida; docs/features/mae-ve-o-que-deve.md).
// Três utilizadores: o dono (empresta o cartão), a mãe (ligada à pessoa "Mãe") e um intruso.

let dono: TestUser
let mae: TestUser
let intruso: TestUser
let conta: string
let despesa: string
let cartao: string

const hojeUtc = (): IsoDate => new Date().toISOString().slice(0, 10)

async function novaPessoa(nome: string) {
  const { data, error } = await dono.client.from('pessoas').insert({ nome }).select('*').single()
  if (error) throw error
  return data
}

async function comprar(pessoaId: string | null, descricao: string, valor = 30000) {
  const { data, error } = await dono.client.rpc('registar_compra_cartao', {
    p_account_id: cartao,
    p_category_id: despesa,
    p_data_compra: hojeUtc(),
    p_valor_total_centavos: valor,
    p_parcelas: 3,
    p_descricao: descricao,
    ...(pessoaId ? { p_pessoa_id: pessoaId } : {}),
  })
  if (error) throw error
  return data
}

async function convidar(pessoaId: string) {
  const { data, error } = await dono.client.rpc('criar_convite_pessoa', { p_pessoa_id: pessoaId })
  if (error) throw error
  return data
}

beforeAll(async () => {
  ;[dono, mae, intruso] = await Promise.all([
    createTestUser('dono'),
    createTestUser('mae'),
    createTestUser('intruso'),
  ])
  const [{ data: c }, { data: d }] = await Promise.all([
    dono.client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    dono.client.from('categories').select('id').eq('nome', 'Alimentação').single(),
  ])
  conta = c!.id
  despesa = d!.id
  const { data: card, error } = await dono.client
    .from('accounts')
    .insert({
      nome: 'Visa',
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 1_000_000,
      conta_pagamento_id: conta,
    })
    .select('id')
    .single()
  if (error) throw error
  cartao = card.id
  await dono.client.from('profiles').update({ nome: 'Edu' }).eq('id', dono.id)
})

describe('convite e ligação', () => {
  it('a mãe aceita o convite e passa a ver só o que é dela', async () => {
    const pessoaMae = await novaPessoa('Mãe')
    const outra = await novaPessoa('Primo')
    await comprar(pessoaMae.id, 'Sofá')
    await comprar(outra.id, 'Do primo')
    await comprar(null, 'Minha')
    await dono.client.from('reembolsos').insert({
      pessoa_id: pessoaMae.id,
      account_id: conta,
      valor_centavos: 5000,
      data: hojeUtc(),
      descricao: 'Pix',
    })

    // Antes de aceitar: nada
    expect((await mae.client.rpc('divida_partilhada')).data).toEqual([])

    const token = await convidar(pessoaMae.id)
    const aceite = await mae.client.rpc('aceitar_convite', { p_token: token })
    expect(aceite.error).toBeNull()
    expect(aceite.data).toBe(pessoaMae.id)

    const { data, error } = await mae.client.rpc('divida_partilhada')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    const row = data![0]
    expect(row.pessoa_nome).toBe('Mãe')
    expect(row.dono_nome).toBe('Edu')
    const compras = row.compras as { descricao: string }[]
    expect(compras.map((compra) => compra.descricao)).toEqual(['Sofá'])
    expect(row.movimentos as unknown[]).toHaveLength(3)
    expect((row.cartoes as { nome: string }[]).map((card) => card.nome)).toEqual(['Visa'])
    expect(row.reembolsos as unknown[]).toHaveLength(1)
    // Nada de saldos, limites nem outras colunas do cartão
    expect(Object.keys((row.cartoes as object[])[0]).sort()).toEqual(['id', 'nome'])

    // As tabelas do dono continuam fechadas para ela
    for (const tabela of [
      'pessoas',
      'compras_cartao',
      'transactions',
      'accounts',
      'faturas',
      'reembolsos',
      'convites_pessoa',
    ] as const) {
      const { data: linhas } = await mae.client.from(tabela).select('id').eq('user_id', dono.id)
      expect(linhas, tabela).toEqual([])
    }

    // O intruso não vê nada
    expect((await intruso.client.rpc('divida_partilhada')).data).toEqual([])
  })

  it('a chave Pix do dono (opcional) chega a quem está ligado, e só o dono a muda', async () => {
    const pessoa = await novaPessoa('Dinda')
    await comprar(pessoa.id, 'Remédio')
    const token = await convidar(pessoa.id)
    expect((await mae.client.rpc('aceitar_convite', { p_token: token })).error).toBeNull()
    const pix = async () =>
      ((await mae.client.rpc('divida_partilhada')).data ?? []).find(
        (row) => row.pessoa_id === pessoa.id,
      )?.dono_chave_pix

    expect(await pix()).toBeNull()
    const salvo = await dono.client
      .from('profiles')
      .update({ chave_pix: 'edu@pix.com' })
      .eq('id', dono.id)
    expect(salvo.error).toBeNull()
    expect(await pix()).toBe('edu@pix.com')

    // Vazia não vale (o app manda null para apagar); muito comprida também não
    const vazia = await dono.client.from('profiles').update({ chave_pix: '' }).eq('id', dono.id)
    expect(vazia.error?.code).toBe('23514')
    const longa = await dono.client
      .from('profiles')
      .update({ chave_pix: 'x'.repeat(121) })
      .eq('id', dono.id)
    expect(longa.error?.code).toBe('23514')

    // Outra pessoa não muda a chave do dono (a RLS só deixa mudar o próprio perfil)
    const { data: mudadas } = await intruso.client
      .from('profiles')
      .update({ chave_pix: 'golpe@pix.com' })
      .eq('id', dono.id)
      .select('id')
    expect(mudadas).toEqual([])
    expect(await pix()).toBe('edu@pix.com')
    await dono.client.from('profiles').update({ chave_pix: null }).eq('id', dono.id)
  })

  it('o convite é de uso único, expira e não serve ao dono nem a uma segunda conta', async () => {
    const pessoa = await novaPessoa('Tia')
    const proprio = await convidar(pessoa.id)
    const doDono = await dono.client.rpc('aceitar_convite', { p_token: proprio })
    expect(doDono.error?.hint).toBe('convite_proprio')

    const token = await convidar(pessoa.id)
    // Gerar outro invalidou o anterior
    expect((await mae.client.rpc('aceitar_convite', { p_token: proprio })).error?.hint).toBe(
      'convite_invalido',
    )
    expect((await mae.client.rpc('aceitar_convite', { p_token: token })).error).toBeNull()
    // Uso único
    expect((await intruso.client.rpc('aceitar_convite', { p_token: token })).error?.hint).toBe(
      'convite_invalido',
    )
    // Já ligada a outra conta: um convite novo não a "rouba"
    const novo = await convidar(pessoa.id)
    expect((await intruso.client.rpc('aceitar_convite', { p_token: novo })).error?.hint).toBe(
      'convite_ja_usado',
    )

    // Expirado
    const outra = await novaPessoa('Avó')
    const velho = await convidar(outra.id)
    await withLocalDb((db) =>
      db.query(
        `update public.convites_pessoa set expira_em = now() - interval '1 minute' where pessoa_id = $1`,
        [outra.id],
      ),
    )
    expect((await mae.client.rpc('aceitar_convite', { p_token: velho })).error?.hint).toBe(
      'convite_invalido',
    )
    expect((await mae.client.rpc('aceitar_convite', { p_token: 'x' })).error?.hint).toBe(
      'convite_invalido',
    )
  })

  it('só o dono convida, e só para pessoas suas e não arquivadas', async () => {
    const pessoa = await novaPessoa('Irmã')
    const alheio = await intruso.client.rpc('criar_convite_pessoa', { p_pessoa_id: pessoa.id })
    expect(alheio.error?.hint).toBe('convite_pessoa_invalida')
    await dono.client.from('pessoas').update({ arquivada: true }).eq('id', pessoa.id)
    const arquivada = await dono.client.rpc('criar_convite_pessoa', { p_pessoa_id: pessoa.id })
    expect(arquivada.error?.hint).toBe('convite_pessoa_invalida')
    // Ninguém liga uma pessoa a alguém escrevendo direto na tabela
    const direto = await dono.client
      .from('pessoas')
      .update({ viewer_id: intruso.id } as never)
      .eq('id', pessoa.id)
    expect(direto.error).not.toBeNull()
    const convite = await intruso.client
      .from('convites_pessoa')
      .insert({ pessoa_id: pessoa.id, token_hash: 'abc' })
    expect(convite.error).not.toBeNull()
  })

  it('deixar de compartilhar (pelo dono ou por quem lê) e arquivar cortam o acesso', async () => {
    const pessoa = await novaPessoa('Madrinha')
    await comprar(pessoa.id, 'Bolsa')
    const ligar = async () =>
      expect(
        (await mae.client.rpc('aceitar_convite', { p_token: await convidar(pessoa.id) })).error,
      ).toBeNull()
    const vê = async () =>
      ((await mae.client.rpc('divida_partilhada')).data ?? []).some(
        (row) => row.pessoa_id === pessoa.id,
      )

    await ligar()
    expect(await vê()).toBe(true)
    // O intruso não consegue desligar
    expect(
      (await intruso.client.rpc('deixar_de_compartilhar', { p_pessoa_id: pessoa.id })).error,
    ).not.toBeNull()
    expect(await vê()).toBe(true)

    expect(
      (await dono.client.rpc('deixar_de_compartilhar', { p_pessoa_id: pessoa.id })).error,
    ).toBeNull()
    expect(await vê()).toBe(false)

    await ligar()
    expect(
      (await mae.client.rpc('deixar_de_compartilhar', { p_pessoa_id: pessoa.id })).error,
    ).toBeNull()
    expect(await vê()).toBe(false)

    await ligar()
    await dono.client.from('pessoas').update({ arquivada: true }).eq('id', pessoa.id)
    expect(await vê()).toBe(false)
  })

  it('sem sessão: nenhuma das funções responde', async () => {
    const anon = anonClient()
    expect((await anon.rpc('divida_partilhada')).error).not.toBeNull()
    expect((await anon.rpc('aceitar_convite', { p_token: 'x' })).error).not.toBeNull()
  })

  it('o esquema private não está exposto pela API', async () => {
    const rows = await withLocalDb(async (db) =>
      (
        await db.query(`
          select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'private' and p.prosecdef
            and has_function_privilege('anon', p.oid, 'execute')`)
      ).rows.map((row: { proname: string }) => row.proname),
    )
    expect(rows).toEqual([])
  })
})
