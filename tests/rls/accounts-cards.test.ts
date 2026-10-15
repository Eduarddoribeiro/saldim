import { beforeAll, describe, expect, it } from 'vitest'
import { validateCardConfig } from '../../src/lib/credit-card'
import { twoUsers, withLocalDb, type Client, type TestUser } from './helpers'

// Etapa C2: contas do tipo cartão de crédito (migration cartao_config).

let a: TestUser
let b: TestUser
let principalA: string
let principalB: string
let despesaB: string

const principal = async (client: Client) =>
  (await client.from('accounts').select('id').eq('nome', 'Conta principal').single()).data!.id

/** Configuração válida de um cartão; `overrides` muda o que o teste precisa. */
const cardRow = (contaPagamento: string, overrides: Record<string, unknown> = {}) => ({
  nome: `Cartão ${crypto.randomUUID().slice(0, 8)}`,
  tipo: 'cartao_credito' as const,
  dia_fechamento: 25,
  dia_vencimento: 5,
  limite_centavos: 500000,
  conta_pagamento_id: contaPagamento,
  ...overrides,
})

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[principalA, principalB] = await Promise.all([principal(a.client), principal(b.client)])
  despesaB = (await b.client.from('categories').select('id').eq('nome', 'Alimentação').single())
    .data!.id
})

describe('cartões — isolamento', () => {
  it('B não usa uma conta de A como conta de pagamento (o erro é igual ao de um id inexistente)', async () => {
    const alheia = await b.client.from('accounts').insert(cardRow(principalA))
    expect(alheia.error?.code).toBe('23503')
    const inexistente = await b.client.from('accounts').insert(cardRow(crypto.randomUUID()))
    expect(inexistente.error?.code).toBe('23503')
  })

  it('B não muda o seu cartão para ser pago por uma conta de A', async () => {
    const { data: cartao } = await b.client
      .from('accounts')
      .insert(cardRow(principalB))
      .select('id')
      .single()
    const { error } = await b.client
      .from('accounts')
      .update({ conta_pagamento_id: principalA })
      .eq('id', cartao!.id)
    expect(error?.code).toBe('23503')
  })

  it('B não vê nem altera os cartões de A', async () => {
    const { data: cartaoDeA } = await a.client
      .from('accounts')
      .insert(cardRow(principalA))
      .select('id')
      .single()
    expect((await b.client.from('accounts').select('id').eq('id', cartaoDeA!.id)).data).toEqual([])
    const alterar = await b.client
      .from('accounts')
      .update({ limite_centavos: 1 })
      .eq('id', cartaoDeA!.id)
      .select()
    expect(alterar.data).toEqual([])
  })
})

describe('cartões — regras de dados', () => {
  it('um cartão válido é criado, sempre com saldo inicial 0', async () => {
    const { data, error } = await b.client
      .from('accounts')
      .insert(cardRow(principalB))
      .select('tipo, saldo_inicial_centavos, dia_fechamento, dia_vencimento, limite_centavos')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({
      tipo: 'cartao_credito',
      saldo_inicial_centavos: 0,
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 500000,
    })
  })

  it('cartão ⇔ quatro campos preenchidos; saldo inicial diferente de 0 é recusado', async () => {
    for (const campo of [
      'dia_fechamento',
      'dia_vencimento',
      'limite_centavos',
      'conta_pagamento_id',
    ]) {
      const { error } = await b.client
        .from('accounts')
        .insert(cardRow(principalB, { [campo]: null }))
      expect(error?.code, campo).toBe('23514')
      expect(error?.message, campo).toContain('accounts_cartao_campos_check')
    }
    const comSaldo = await b.client
      .from('accounts')
      .insert(cardRow(principalB, { saldo_inicial_centavos: 1000 }))
    expect(comSaldo.error?.message).toContain('accounts_cartao_campos_check')
    // Uma conta normal não pode ter campos de cartão
    const normal = await b.client
      .from('accounts')
      .insert({ nome: 'Banco com dia', tipo: 'corrente', dia_fechamento: 10 })
    expect(normal.error?.message).toContain('accounts_cartao_campos_check')
  })

  it('EXAUSTIVO: o CHECK dos dias aceita exatamente o que validateCardConfig aceita (961 pares)', async () => {
    const divergencias = await withLocalDb(async (db) => {
      const found: string[] = []
      await db.query('begin')
      try {
        for (let f = 1; f <= 31; f++) {
          for (let v = 1; v <= 31; v++) {
            await db.query('savepoint par')
            let aceite = true
            try {
              await db.query(
                `insert into public.accounts
                   (user_id, nome, tipo, dia_fechamento, dia_vencimento, limite_centavos, conta_pagamento_id)
                 values ($1, $2, 'cartao_credito', $3, $4, 1, $5)`,
                [b.id, `par ${f}-${v}`, f, v, principalB],
              )
              await db.query('release savepoint par')
            } catch (error) {
              aceite = false
              expect((error as { constraint?: string }).constraint).toBe(
                'accounts_cartao_dias_check',
              )
              await db.query('rollback to savepoint par')
            }
            const esperado = validateCardConfig({
              diaFechamento: f,
              diaVencimento: v,
              limiteCentavos: 1,
            }).ok
            if (aceite !== esperado) found.push(`F=${f} V=${v}`)
          }
        }
      } finally {
        // Nada fica gravado: os 924 cartões de teste desaparecem
        await db.query('rollback')
      }
      return found
    })
    expect(divergencias).toEqual([])
  })

  it('dias fora de 1–31 e limites inválidos são recusados', async () => {
    for (const overrides of [
      { dia_fechamento: 0 },
      { dia_vencimento: 32 },
      { limite_centavos: 0 },
      { limite_centavos: 100_000_000_000 },
    ]) {
      const { error } = await b.client.from('accounts').insert(cardRow(principalB, overrides))
      expect(error?.code, JSON.stringify(overrides)).toBe('23514')
    }
  })

  it('um cartão não é a sua própria conta de pagamento nem é pago por outro cartão', async () => {
    const id = crypto.randomUUID()
    const propria = await b.client.from('accounts').insert(cardRow(id, { id }))
    expect(propria.error?.message).toContain('accounts_conta_pagamento_propria_check')

    const { data: outro } = await b.client
      .from('accounts')
      .insert(cardRow(principalB))
      .select('id')
      .single()
    const pagoPorCartao = await b.client.from('accounts').insert(cardRow(outro!.id))
    expect(pagoPorCartao.error?.code).toBe('23514')
    expect(pagoPorCartao.error?.hint).toBe('accounts_conta_pagamento_tipo_check')
  })

  it('uma conta que paga um cartão não pode passar a ser cartão', async () => {
    const { data: banco } = await b.client
      .from('accounts')
      .insert({ nome: 'Banco pagador' })
      .select('id')
      .single()
    await b.client.from('accounts').insert(cardRow(banco!.id))
    const { error } = await b.client
      .from('accounts')
      .update(cardRow(principalB, { nome: 'Banco pagador' }))
      .eq('id', banco!.id)
    expect(error?.hint).toBe('accounts_conta_pagamento_tipo_check')
  })

  it('uma conta com transações não muda para cartão', async () => {
    const { data: banco } = await b.client
      .from('accounts')
      .insert({ nome: 'Banco com movimentos' })
      .select('id')
      .single()
    const tx = await b.client.from('transactions').insert({
      account_id: banco!.id,
      category_id: despesaB,
      tipo: 'despesa',
      valor_centavos: 1000,
    })
    expect(tx.error).toBeNull()
    const { error } = await b.client
      .from('accounts')
      .update(cardRow(principalB, { nome: 'Banco com movimentos' }))
      .eq('id', banco!.id)
    expect(error?.hint).toBe('accounts_tipo_cartao_em_uso_check')
  })

  it('até à C3: uma transação normal não pode usar um cartão (nem ser movida para um)', async () => {
    const { data: cartao } = await b.client
      .from('accounts')
      .insert(cardRow(principalB))
      .select('id')
      .single()
    const nova = await b.client.from('transactions').insert({
      account_id: cartao!.id,
      category_id: despesaB,
      tipo: 'despesa',
      valor_centavos: 1000,
    })
    expect(nova.error?.hint).toBe('transactions_conta_cartao_check')

    const { data: tx } = await b.client
      .from('transactions')
      .insert({
        account_id: principalB,
        category_id: despesaB,
        tipo: 'despesa',
        valor_centavos: 500,
      })
      .select('id')
      .single()
    const mover = await b.client
      .from('transactions')
      .update({ account_id: cartao!.id })
      .eq('id', tx!.id)
    expect(mover.error?.hint).toBe('transactions_conta_cartao_check')
  })

  it('não se apaga a conta de pagamento de um cartão, mas pode ser arquivada', async () => {
    const { data: banco } = await b.client
      .from('accounts')
      .insert({ nome: 'Banco do cartão' })
      .select('id')
      .single()
    await b.client.from('accounts').insert(cardRow(banco!.id))
    const apagar = await b.client.from('accounts').delete().eq('id', banco!.id)
    expect(apagar.error?.code).toBe('23503')
    expect(apagar.error?.message).toContain('accounts_conta_pagamento_fk')

    const arquivar = await b.client
      .from('accounts')
      .update({ arquivada: true })
      .eq('id', banco!.id)
      .select('arquivada')
      .single()
    expect(arquivar.data?.arquivada).toBe(true)
  })

  it('o dono edita a configuração do cartão e pode voltar a torná-lo uma conta normal', async () => {
    const { data: cartao } = await b.client
      .from('accounts')
      .insert(cardRow(principalB))
      .select('id')
      .single()
    const editar = await b.client
      .from('accounts')
      .update({ dia_fechamento: 3, dia_vencimento: 10, limite_centavos: 100000 })
      .eq('id', cartao!.id)
      .select('dia_fechamento, dia_vencimento, limite_centavos')
      .single()
    expect(editar.data).toEqual({ dia_fechamento: 3, dia_vencimento: 10, limite_centavos: 100000 })

    const normal = await b.client
      .from('accounts')
      .update({
        tipo: 'corrente',
        dia_fechamento: null,
        dia_vencimento: null,
        limite_centavos: null,
        conta_pagamento_id: null,
      })
      .eq('id', cartao!.id)
      .select('tipo')
      .single()
    expect(normal.error).toBeNull()
    expect(normal.data?.tipo).toBe('corrente')
  })
})
