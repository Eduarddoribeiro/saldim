import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, withLocalDb, type TestUser } from './helpers'

// dias_fechados (migration dias_fechados): cada um só vê e fecha os seus dias; só se fecha o dia de
// hoje (com um dia de folga para os fusos), sem duplicar.

let a: TestUser
let b: TestUser
let hoje: string

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  // O "hoje" da base de dados (current_date), para não depender do fuso da máquina dos testes
  hoje = await withLocalDb(async (db) => {
    const { rows } = await db.query<{ hoje: string }>(`select current_date::text as hoje`)
    return rows[0].hoje
  })
})

describe('dias_fechados', () => {
  it('fecha o dia de hoje; fechar de novo não duplica', async () => {
    const fechar = () =>
      a.client
        .from('dias_fechados')
        .upsert({ dia: hoje }, { onConflict: 'user_id,dia', ignoreDuplicates: true })
    expect((await fechar()).error).toBeNull()
    expect((await fechar()).error).toBeNull()
    const { data } = await a.client.from('dias_fechados').select('dia')
    expect(data).toEqual([{ dia: hoje }])
  })

  it('não se fecham dias passados nem futuros (para não encher a sequência)', async () => {
    for (const dia of [shift(hoje, -2), shift(hoje, 2)]) {
      const { error } = await a.client.from('dias_fechados').insert({ dia })
      expect(error?.code, dia).toBe('23514')
    }
    // Um dia de folga para os fusos horários
    expect((await a.client.from('dias_fechados').insert({ dia: shift(hoje, -1) })).error).toBeNull()
  })

  it('B não vê nem apaga os dias de A, nem fecha em nome de A; anon não vê nada', async () => {
    expect((await b.client.from('dias_fechados').select('id')).data).toEqual([])
    await b.client.from('dias_fechados').delete().eq('dia', hoje)
    expect((await a.client.from('dias_fechados').select('dia').eq('dia', hoje)).data).toHaveLength(
      1,
    )
    const emNomeDeA = await b.client
      .from('dias_fechados')
      .insert({ user_id: a.id, dia: hoje } as never)
    expect(emNomeDeA.error).not.toBeNull()
    expect((await anonClient().from('dias_fechados').select('id')).data ?? []).toEqual([])
  })

  it('não há update: um dia fechado não muda de data', async () => {
    const { data } = await a.client
      .from('dias_fechados')
      .update({ dia: shift(hoje, -1) } as never)
      .eq('dia', hoje)
      .select('id')
    expect(data ?? []).toEqual([])
  })
})
