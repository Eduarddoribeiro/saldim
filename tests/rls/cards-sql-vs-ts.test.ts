import { describe, expect, it } from 'vitest'
import {
  invoiceDates,
  invoiceForPurchase,
  splitInstallments,
  validateCardConfig,
} from '../../src/lib/credit-card'
import { addMonths, addMonthsClamped, lastDayOfMonth } from '../../src/lib/dates'
import { withLocalDb } from './helpers'

// Etapa C3: os cálculos em SQL (migration faturas_compras) dão exatamente o mesmo que os de
// src/lib/credit-card.ts. A interface mostra as contas do TypeScript e a base de dados grava as do SQL:
// têm de coincidir em todas as configurações válidas e em todos os dias do período testado.

type Row = { f: number; v: number; valores: string }

/** As 924 configurações válidas, pela ordem (F, V). */
const CONFIGS = Array.from({ length: 31 * 31 }, (_, index) => ({
  diaFechamento: Math.floor(index / 31) + 1,
  diaVencimento: (index % 31) + 1,
})).filter((config) => validateCardConfig({ ...config, limiteCentavos: 1 }).ok)

const CFG_SQL = `
  with cfg as (
    select f, v from generate_series(1, 31) f, generate_series(1, 31) v
    where f <> v and not (v > f and f >= 28)
  )`

/** Compara linha a linha e devolve só as diferenças (uma lista vazia = tudo igual). */
function diferencas(rows: Row[], esperado: (f: number, v: number) => string): string[] {
  expect(rows.map((row) => `${row.f}-${row.v}`)).toEqual(
    CONFIGS.map((c) => `${c.diaFechamento}-${c.diaVencimento}`),
  )
  return rows
    .filter((row) => row.valores !== esperado(row.f, row.v))
    .map((row) => `F=${row.f} V=${row.v}`)
}

describe('cálculos SQL = cálculos TypeScript', () => {
  it('datas das faturas: 924 configurações × 29 meses (inclui 2000 e 2100 em fevereiro)', async () => {
    const meses = [
      ...Array.from({ length: 24 }, (_, index) => addMonths('2027-01', index)),
      '2000-02',
      '2000-03',
      '2100-02',
      '2100-03',
      '2999-12',
    ]
    const rows = await withLocalDb(
      async (db) =>
        (
          await db.query<Row>(
            `${CFG_SQL}
             select f, v, string_agg(d.fechamento::text || '/' || d.vencimento::text, ',' order by m.ord) as valores
             from cfg,
               unnest($1::date[]) with ordinality as m(mes, ord),
               lateral public.cartao_datas_fatura(f, v, m.mes) d
             group by f, v order by f, v`,
            [meses.map((mes) => `${mes}-01`)],
          )
        ).rows,
    )
    const esperado = (f: number, v: number) =>
      meses
        .map((mes) => {
          const datas = invoiceDates({ diaFechamento: f, diaVencimento: v }, mes)
          return `${datas.fechamento}/${datas.vencimento}`
        })
        .join(',')
    expect(diferencas(rows, esperado)).toEqual([])
  })

  it('fatura de uma compra: 924 configurações × os dias de fronteira de dez/2027 a jan/2029', async () => {
    // Só os dias em que o resultado pode mudar: 1.º e último dia do mês e a véspera, o dia e o dia
    // seguinte ao fechamento (já ajustado ao mês). O SQL não é inline, por isso cada dia custa ~60 µs;
    // o teste unitário da C1 já percorre todos os dias do lado do TypeScript.
    const meses = Array.from({ length: 14 }, (_, index) => addMonths('2027-12', index))
    const datasDe = (f: number) =>
      meses.flatMap((mes) => {
        const ultimo = lastDayOfMonth(mes)
        const fecha = Math.min(f, Number(ultimo.slice(8, 10)))
        return [...new Set([1, fecha - 1, fecha, fecha + 1, Number(ultimo.slice(8, 10))])]
          .filter((dia) => dia >= 1 && `${mes}-${String(dia).padStart(2, '0')}` <= ultimo)
          .sort((x, y) => x - y)
          .map((dia) => `${mes}-${String(dia).padStart(2, '0')}`)
      })
    const casos = CONFIGS.flatMap(({ diaFechamento: f, diaVencimento: v }) =>
      datasDe(f).map((data) => ({ f, v, data })),
    )
    const rows = await withLocalDb(
      async (db) =>
        (
          await db.query<Row>(
            `select f, v,
               string_agg(to_char(public.cartao_fatura_da_compra(f, v, d), 'YYYY-MM'), ',' order by ord) as valores
             from unnest($1::int[], $2::int[], $3::date[]) with ordinality as caso(f, v, d, ord)
             group by f, v order by f, v`,
            [casos.map((c) => c.f), casos.map((c) => c.v), casos.map((c) => c.data)],
          )
        ).rows,
    )
    const esperado = (f: number, v: number) =>
      datasDe(f)
        .map((data) => invoiceForPurchase({ diaFechamento: f, diaVencimento: v }, data))
        .join(',')
    expect(diferencas(rows, esperado)).toEqual([])
  })

  it('valor das parcelas: n de 1 a 48 e totais pequenos, redondos e máximos', async () => {
    const totais = [1, 2, 47, 48, 49, 100, 999, 10000, 123457, 99999999999]
    const rows = await withLocalDb(
      async (db) =>
        (
          await db.query<{ total: string; n: number; valores: string }>(
            `select t::text as total, n,
               string_agg(public.cartao_valor_parcela(t, n, k)::text, ',' order by k) as valores
             from unnest($1::bigint[]) t, generate_series(1, 48) n, generate_series(1, n) k
             where t >= n
             group by t, n order by t, n`,
            [totais],
          )
        ).rows,
    )
    const esperado = totais.flatMap((total) =>
      Array.from({ length: 48 }, (_, index) => index + 1)
        .filter((n) => total >= n)
        .map((n) => ({ total: String(total), n, valores: splitInstallments(total, n).join(',') })),
    )
    expect(rows).toEqual(esperado)
  })

  it('data das parcelas: dias 1 e 28–31 de cada mês de 2027–2028, parcelas 1 a 48', async () => {
    const datas = Array.from({ length: 24 }, (_, index) => addMonths('2027-01', index)).flatMap(
      (mes) =>
        ['01', '28', '29', '30', '31']
          .map((dia) => `${mes}-${dia}`)
          .filter((data) => data <= lastDayOfMonth(mes)),
    )
    const rows = await withLocalDb(
      async (db) =>
        (
          await db.query<{ data: string; valores: string }>(
            `select d::text as data,
               string_agg(public.cartao_data_parcela(d, k)::text, ',' order by k) as valores
             from unnest($1::date[]) d, generate_series(1, 48) k
             group by d order by d`,
            [datas],
          )
        ).rows,
    )
    expect(rows).toEqual(
      datas.map((data) => ({
        data,
        valores: Array.from({ length: 48 }, (_, k) => addMonthsClamped(data, k)).join(','),
      })),
    )
  })
})
