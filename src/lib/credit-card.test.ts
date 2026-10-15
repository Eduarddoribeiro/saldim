import { describe, expect, it } from 'vitest'
import {
  installmentSchedule,
  invoiceDates,
  invoiceForPurchase,
  invoiceStatus,
  MAX_PARCELAS,
  paymentWindowDays,
  splitInstallments,
  validateCardConfig,
  type CardConfig,
  type InvoiceStatusInput,
} from './credit-card'
import { addMonths, daysBetween, type IsoDate, type MonthKey } from './dates'
import { MAX_CENTS } from './money'

const DIAS = Array.from({ length: 31 }, (_, index) => index + 1)
const config = (diaFechamento: number, diaVencimento: number): CardConfig => ({
  diaFechamento,
  diaVencimento,
})
const months = (start: MonthKey, count: number) =>
  Array.from({ length: count }, (_, index) => addMonths(start, index))
const days = (from: IsoDate, to: IsoDate) => {
  const list: IsoDate[] = []
  for (let day = from; day <= to; day = nextDay(day)) list.push(day)
  return list
}
/** Último dia do mês, calculado sem o código testado (dia 0 do mês seguinte). */
const lastOf = (month: MonthKey) => {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index, 0).getDate()
}
const pad = (value: number) => String(value).padStart(2, '0')
function nextDay(date: IsoDate): IsoDate {
  const month = date.slice(0, 7)
  const day = Number(date.slice(8, 10))
  return day < lastOf(month) ? `${month}-${pad(day + 1)}` : `${addMonths(month, 1)}-01`
}
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/** Todas as configurações (F, V) válidas, para os testes exaustivos. */
const VALID_CONFIGS = DIAS.flatMap((f) => DIAS.map((v) => config(f, v))).filter(
  (c) => validateCardConfig({ ...c, limiteCentavos: 1 }).ok,
)

describe('validateCardConfig', () => {
  const valid = (f: number, v: number, limiteCentavos = 500000) =>
    validateCardConfig({ diaFechamento: f, diaVencimento: v, limiteCentavos })

  it('aceita configurações habituais, sem avisos', () => {
    expect(valid(3, 10)).toEqual({ ok: true, errors: [], warnings: [] })
    expect(valid(25, 5)).toEqual({ ok: true, errors: [], warnings: [] })
  })

  it('recusa fechamento igual ao vencimento', () => {
    const result = valid(10, 10)
    expect(result.ok).toBe(false)
    expect(result.errors.map((e) => e.field)).toEqual(['diaVencimento'])
  })

  it('fechamento ≥ 28 com vencimento no mesmo mês é recusado (fevereiro daria prazo 0)', () => {
    expect(valid(28, 30).ok).toBe(false)
    expect(valid(29, 31).ok).toBe(false)
    expect(valid(28, 30).errors.map((e) => e.field)).toEqual(['diaFechamento'])
    // Até 27 é possível, mesmo com prazos curtos (só aviso)
    expect(valid(27, 28).ok).toBe(true)
    // Fechamento no fim do mês com vencimento no mês seguinte é válido
    expect(valid(31, 10).ok).toBe(true)
  })

  it('dias fora de 1–31 ou não inteiros são recusados', () => {
    expect(valid(0, 10).errors.map((e) => e.field)).toEqual(['diaFechamento'])
    expect(valid(10, 32).errors.map((e) => e.field)).toEqual(['diaVencimento'])
    expect(valid(10.5, 20).ok).toBe(false)
    expect(valid(Number.NaN, 20).ok).toBe(false)
  })

  it('limite: inteiro de 1 a MAX_CENTS centavos', () => {
    expect(valid(3, 10, 1).ok).toBe(true)
    expect(valid(3, 10, MAX_CENTS).ok).toBe(true)
    for (const limite of [0, -100, MAX_CENTS + 1, 12.5, Number.NaN]) {
      expect(valid(3, 10, limite).errors.map((e) => e.field)).toEqual(['limiteCentavos'])
    }
  })

  it('avisa (sem recusar) quando o prazo sai de 5–25 dias em algum mês', () => {
    // 27 → 28: 1 dia (prazo fixo: 'é de', no singular)
    expect(valid(27, 28).warnings[0].message).toMatch(/prazo .* é de 1 dia\. /)
    expect(valid(3, 10).warnings).toEqual([])
    // 2 → 1 do mês seguinte: 27 a 30 dias
    expect(valid(2, 1).warnings).toHaveLength(1)
    expect(valid(2, 1).warnings[0].message).toMatch(/entre 27 e 30 dias/)
    // 10 → 15: 5 dias; 20 → 15 do mês seguinte: 23 a 26 dias (passa de 25 em meses de 31)
    expect(valid(10, 15).warnings).toEqual([])
    expect(valid(20, 15).warnings).toHaveLength(1)
  })

  it('EXAUSTIVO (961 pares): válido ⇔ F ≠ V e prazo > 0 em todos os meses ⇔ regra da migration', () => {
    const falhas: string[] = []
    let validos = 0
    for (const f of DIAS) {
      for (const v of DIAS) {
        const ok = valid(f, v).ok
        if (ok) validos++
        if (ok !== (f !== v && paymentWindowDays(f, v).min > 0)) falhas.push(`prazo F=${f} V=${v}`)
        // A mesma regra, escrita como ficará no CHECK SQL
        if (ok !== (f !== v && !(v > f && f >= 28))) falhas.push(`regra F=${f} V=${v}`)
      }
    }
    expect(falhas).toEqual([])
    // 961 − 31 (F = V) − 6 (F ≥ 28 com V > F: 28→29..31, 29→30..31, 30→31)
    expect(validos).toBe(924)
  })
})

describe('paymentWindowDays (prazo entre fechamento e vencimento)', () => {
  it('mesmo mês (V > F): prazo fixo, exceto quando o mês corta os dias', () => {
    expect(paymentWindowDays(3, 10)).toEqual({ min: 7, max: 7 })
    expect(paymentWindowDays(27, 28)).toEqual({ min: 1, max: 1 })
    // 26 → 31: fevereiro 26→28 (2), bissexto 26→29 (3), abril 26→30 (4), 31 dias (5)
    expect(paymentWindowDays(26, 31)).toEqual({ min: 2, max: 5 })
  })

  it('mês seguinte (V < F): depende do comprimento do mês do fechamento', () => {
    // 25 de fev → 5 de mar = 8 (bissexto 9); 25 de mês de 31 → 5 = 11
    expect(paymentWindowDays(25, 5)).toEqual({ min: 8, max: 11 })
    // Fecha no último dia do mês, vence no dia 1: sempre 1 dia
    expect(paymentWindowDays(31, 1)).toEqual({ min: 1, max: 1 })
    expect(paymentWindowDays(2, 1)).toEqual({ min: 27, max: 30 })
  })

  it('mede também configurações recusadas (para explicar porquê)', () => {
    expect(paymentWindowDays(28, 30).min).toBe(0) // fevereiro: 28 → 28
    expect(paymentWindowDays(10, 10)).toEqual({ min: 28, max: 31 }) // um mês inteiro
  })

  it('a janela de 2027–2028 dá os mesmos valores que 8 anos seguidos (2025–2032)', () => {
    const wide = months('2025-01', 96)
    for (const f of DIAS) {
      for (const v of DIAS) {
        if (f === v) continue
        const prazos = wide.map((month) => {
          // Datas calculadas à mão, sem passar pelo código testado
          const fechMes = v > f ? month : addMonths(month, -1)
          const fechamento = `${fechMes}-${pad(Math.min(f, lastOf(fechMes)))}`
          const vencimento = `${month}-${pad(Math.min(v, lastOf(month)))}`
          return daysBetween(fechamento, vencimento)
        })
        expect(paymentWindowDays(f, v), `F=${f} V=${v}`).toEqual({
          min: Math.min(...prazos),
          max: Math.max(...prazos),
        })
      }
    }
  })

  it('recusa dias fora de 1–31', () => {
    expect(() => paymentWindowDays(0, 10)).toThrow(RangeError)
    expect(() => paymentWindowDays(10, 32)).toThrow(RangeError)
  })
})

describe('invoiceDates', () => {
  it('V > F: fecha e vence no mesmo mês', () => {
    expect(invoiceDates(config(3, 10), '2026-10')).toEqual({
      mesReferencia: '2026-10',
      inicioCiclo: '2026-09-03',
      fechamento: '2026-10-03',
      vencimento: '2026-10-10',
    })
  })

  it('V < F: fecha no mês anterior, incluindo a viragem do ano', () => {
    expect(invoiceDates(config(25, 5), '2027-01')).toEqual({
      mesReferencia: '2027-01',
      inicioCiclo: '2026-11-25',
      fechamento: '2026-12-25',
      vencimento: '2027-01-05',
    })
  })

  it('fechamento no dia 31: último dia de meses de 28, 29 e 30 dias', () => {
    const cartao = config(31, 10)
    expect(invoiceDates(cartao, '2026-03')).toMatchObject({
      inicioCiclo: '2026-01-31',
      fechamento: '2026-02-28',
    })
    expect(invoiceDates(cartao, '2028-03').fechamento).toBe('2028-02-29') // bissexto
    expect(invoiceDates(cartao, '2100-03').fechamento).toBe('2100-02-28') // 2100 não é bissexto
    expect(invoiceDates(cartao, '2026-05')).toMatchObject({
      inicioCiclo: '2026-03-31',
      fechamento: '2026-04-30',
    })
    expect(invoiceDates(cartao, '2027-01')).toMatchObject({
      inicioCiclo: '2026-11-30',
      fechamento: '2026-12-31',
      vencimento: '2027-01-10',
    })
  })

  it('vencimento nos dias 29, 30 e 31 passa ao último dia de meses curtos', () => {
    expect(invoiceDates(config(20, 31), '2026-04').vencimento).toBe('2026-04-30')
    expect(invoiceDates(config(5, 30), '2026-02').vencimento).toBe('2026-02-28')
    expect(invoiceDates(config(5, 29), '2028-02').vencimento).toBe('2028-02-29')
    expect(invoiceDates(config(5, 29), '2026-02').vencimento).toBe('2026-02-28')
  })

  it('EXAUSTIVO: em 48 meses, ciclos contíguos, fechamentos crescentes e fechamento < vencimento', () => {
    const falhas: string[] = []
    for (const cartao of VALID_CONFIGS) {
      const faturas = months('2027-01', 48).map((month) => invoiceDates(cartao, month))
      faturas.forEach((fatura, index) => {
        const ok =
          fatura.inicioCiclo < fatura.fechamento &&
          fatura.fechamento < fatura.vencimento &&
          (index === 0 || fatura.inicioCiclo === faturas[index - 1].fechamento)
        if (!ok) {
          falhas.push(`F=${cartao.diaFechamento} V=${cartao.diaVencimento} ${fatura.mesReferencia}`)
        }
      })
    }
    expect(falhas).toEqual([])
  })

  it('recusa configurações e meses inválidos', () => {
    expect(() => invoiceDates(config(10, 10), '2026-10')).toThrow(RangeError)
    expect(() => invoiceDates(config(28, 30), '2026-10')).toThrow(RangeError)
    expect(() => invoiceDates(config(3, 10), '2026-13')).toThrow(RangeError)
  })
})

describe('invoiceForPurchase', () => {
  it('compra no dia do fechamento vai para a fatura seguinte (V < F)', () => {
    const cartao = config(25, 5) // fatura de novembro: [25/09, 25/10)
    expect(invoiceForPurchase(cartao, '2026-10-24')).toBe('2026-11')
    expect(invoiceForPurchase(cartao, '2026-10-25')).toBe('2026-12')
    expect(invoiceForPurchase(cartao, '2026-10-26')).toBe('2026-12')
    expect(invoiceForPurchase(cartao, '2026-10-01')).toBe('2026-11')
  })

  it('compra no dia do fechamento vai para a fatura seguinte (V > F)', () => {
    const cartao = config(3, 10)
    expect(invoiceForPurchase(cartao, '2026-10-02')).toBe('2026-10')
    expect(invoiceForPurchase(cartao, '2026-10-03')).toBe('2026-11')
    expect(invoiceForPurchase(cartao, '2026-10-04')).toBe('2026-11')
  })

  it('fechamento 31 em fevereiro: o dia de fecho é o 28 (ou 29 em ano bissexto)', () => {
    const cartao = config(31, 10)
    expect(invoiceForPurchase(cartao, '2026-02-27')).toBe('2026-03')
    expect(invoiceForPurchase(cartao, '2026-02-28')).toBe('2026-04')
    expect(invoiceForPurchase(cartao, '2028-02-28')).toBe('2028-03')
    expect(invoiceForPurchase(cartao, '2028-02-29')).toBe('2028-04')
  })

  it('viragem do ano', () => {
    expect(invoiceForPurchase(config(31, 10), '2026-12-30')).toBe('2027-01')
    expect(invoiceForPurchase(config(31, 10), '2026-12-31')).toBe('2027-02')
    expect(invoiceForPurchase(config(20, 28), '2026-12-19')).toBe('2026-12')
    expect(invoiceForPurchase(config(20, 28), '2026-12-20')).toBe('2027-01')
  })

  it('EXAUSTIVO: cada dia de dez/2027–jan/2029 está em UM só ciclo, e é o da fatura devolvida', () => {
    // Inclui duas viragens de ano, fevereiro bissexto e todos os meses de 30 e 31 dias
    const dias = days('2027-12-01', '2029-01-31')
    const falhas: string[] = []
    for (const cartao of VALID_CONFIGS) {
      // Ciclos de nov/2027 a abr/2029: cobrem com folga todas as datas acima
      const ciclos = months('2027-11', 18).map((month) => invoiceDates(cartao, month))
      for (const dia of dias) {
        const contem = ciclos.filter((c) => c.inicioCiclo <= dia && dia < c.fechamento)
        if (contem.length !== 1 || contem[0].mesReferencia !== invoiceForPurchase(cartao, dia)) {
          falhas.push(`F=${cartao.diaFechamento} V=${cartao.diaVencimento} ${dia}`)
        }
      }
    }
    expect(falhas).toEqual([])
  })

  it('recusa datas inválidas', () => {
    expect(() => invoiceForPurchase(config(3, 10), '2026-02-30')).toThrow(RangeError)
  })
})

describe('splitInstallments', () => {
  it('a diferença do arredondamento fica na última parcela', () => {
    expect(splitInstallments(10000, 3)).toEqual([3333, 3333, 3334])
    expect(splitInstallments(1000, 3)).toEqual([333, 333, 334])
    expect(splitInstallments(10000, 4)).toEqual([2500, 2500, 2500, 2500])
    expect(splitInstallments(1, 1)).toEqual([1])
    expect(splitInstallments(3, 3)).toEqual([1, 1, 1])
  })

  it('MAX_CENTS em 48 parcelas: soma exata, sem perder centavos', () => {
    const parcelas = splitInstallments(MAX_CENTS, MAX_PARCELAS)
    expect(sum(parcelas)).toBe(MAX_CENTS)
    expect(parcelas.at(-1)! - parcelas[0]).toBe(15)
  })

  it('EXAUSTIVO: n de 1 a 48 × vários totais: soma exata, só a última difere, diferença < n', () => {
    const totais = [48, 97, 100, 101, 997, 1000, 9999, 123457, 1000003, MAX_CENTS - 1, MAX_CENTS]
    const falhas: string[] = []
    for (let n = 1; n <= MAX_PARCELAS; n++) {
      for (const total of totais) {
        if (total < n) continue
        const parcelas = splitInstallments(total, n)
        const ultima = parcelas.at(-1)!
        const ok =
          parcelas.length === n &&
          sum(parcelas) === total &&
          parcelas.every((p) => Number.isSafeInteger(p) && p >= 1) &&
          new Set(parcelas.slice(0, -1)).size <= 1 &&
          ultima >= parcelas[0] &&
          ultima - parcelas[0] < n
        if (!ok) falhas.push(`${total}/${n}`)
      }
    }
    expect(falhas).toEqual([])
  })

  it('recusa valores e números de parcelas inválidos', () => {
    expect(() => splitInstallments(2, 3)).toThrow(RangeError) // < 1 centavo por parcela
    expect(() => splitInstallments(0, 1)).toThrow(RangeError)
    expect(() => splitInstallments(-100, 1)).toThrow(RangeError)
    expect(() => splitInstallments(MAX_CENTS + 1, 1)).toThrow(RangeError)
    expect(() => splitInstallments(12.5, 1)).toThrow(TypeError)
    expect(() => splitInstallments(1000, 0)).toThrow(RangeError)
    expect(() => splitInstallments(1000, MAX_PARCELAS + 1)).toThrow(RangeError)
    expect(() => splitInstallments(1000, 2.5)).toThrow(RangeError)
  })
})

describe('installmentSchedule', () => {
  const cartao = config(25, 5)
  const schedule = (
    dataCompra: IsoDate,
    numeroParcelas: number,
    totalCentavos = 10000 * numeroParcelas,
    parcelaInicial?: number,
  ) =>
    installmentSchedule({
      dataCompra,
      totalCentavos,
      numeroParcelas,
      parcelaInicial,
      config: cartao,
    })

  it('compra à vista: uma parcela, na data da compra e na fatura da compra', () => {
    expect(schedule('2026-10-14', 1, 4990)).toEqual({
      parcelas: [{ numero: 1, valorCentavos: 4990, data: '2026-10-14', mesFatura: '2026-11' }],
      restanteCentavos: 4990,
    })
  })

  it('datas a partir da data ORIGINAL: compra no dia 31 recupera o 31 depois de fevereiro', () => {
    expect(schedule('2026-01-31', 4).parcelas.map((p) => p.data)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('compras nos dias 29 e 30 atravessando fevereiro normal e bissexto', () => {
    expect(schedule('2028-01-29', 2).parcelas.map((p) => p.data)).toEqual([
      '2028-01-29',
      '2028-02-29',
    ])
    expect(schedule('2027-01-29', 3).parcelas.map((p) => p.data)).toEqual([
      '2027-01-29',
      '2027-02-28',
      '2027-03-29',
    ])
    expect(schedule('2026-11-30', 4).parcelas.map((p) => p.data)).toEqual([
      '2026-11-30',
      '2026-12-30',
      '2027-01-30',
      '2027-02-28',
    ])
  })

  it('viragem do ano: datas e faturas em meses seguidos', () => {
    const { parcelas } = schedule('2026-11-15', 4)
    expect(parcelas.map((p) => p.data)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
      '2027-02-15',
    ])
    // 15/11 com fechamento a 25 → fatura de dezembro, depois janeiro, fevereiro, março
    expect(parcelas.map((p) => p.mesFatura)).toEqual(['2026-12', '2027-01', '2027-02', '2027-03'])
  })

  it('compra no dia do fechamento: todas as parcelas começam na fatura seguinte', () => {
    expect(schedule('2026-10-25', 3).parcelas.map((p) => p.mesFatura)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })

  it('soma exata do valor original, com a diferença na última parcela', () => {
    const { parcelas, restanteCentavos } = schedule('2026-10-14', 3, 10000)
    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3333, 3333, 3334])
    expect(restanteCentavos).toBe(10000)
  })

  it('EXAUSTIVO: datas nunca recuam e caem no mês certo, para compras nos dias 28–31', () => {
    const falhas: string[] = []
    const compras = days('2027-12-28', '2028-01-31').filter((d) => d.slice(8) >= '28')
    expect(compras).toHaveLength(8) // 28–31 de dezembro e 28–31 de janeiro
    for (const dataCompra of compras) {
      const { parcelas } = schedule(dataCompra, MAX_PARCELAS)
      parcelas.forEach((parcela, index) => {
        const anterior = parcelas[index - 1]
        const ok =
          parcela.data.slice(0, 7) === addMonths(dataCompra.slice(0, 7), index) &&
          // Mesmo dia da compra, ou o último dia de um mês mais curto
          (parcela.data.slice(8) === dataCompra.slice(8) ||
            Number(parcela.data.slice(8)) === lastOf(parcela.data.slice(0, 7))) &&
          parcela.data.slice(8) <= dataCompra.slice(8) &&
          (!anterior ||
            (parcela.data > anterior.data &&
              parcela.mesFatura === addMonths(anterior.mesFatura, 1)))
        if (!ok) falhas.push(`${dataCompra} parcela ${parcela.numero}: ${parcela.data}`)
      })
    }
    expect(falhas).toEqual([])
  })

  describe('compra já em curso (parcela inicial k > 1)', () => {
    it('k = 1 é igual a uma compra nova', () => {
      expect(schedule('2026-03-10', 10, 100000, 1)).toEqual(schedule('2026-03-10', 10, 100000))
    })

    it('5/10 de 1.000,00: só as parcelas 5 a 10, restante 600,00, nos mesmos meses da compra completa', () => {
      const completa = schedule('2026-03-10', 10, 100000).parcelas
      const emCurso = schedule('2026-03-10', 10, 100000, 5)
      expect(emCurso.parcelas.map((p) => p.numero)).toEqual([5, 6, 7, 8, 9, 10])
      expect(emCurso.parcelas).toEqual(completa.slice(4))
      expect(emCurso.restanteCentavos).toBe(60000)
    })

    it('o arredondamento é o da compra completa: a última parcela leva o resto', () => {
      const emCurso = schedule('2026-03-10', 3, 10000, 2)
      expect(emCurso.parcelas.map((p) => p.valorCentavos)).toEqual([3333, 3334])
      expect(emCurso.restanteCentavos).toBe(6667)
      expect(schedule('2026-03-10', 3, 10000, 3).parcelas).toEqual([
        { numero: 3, valorCentavos: 3334, data: '2026-05-10', mesFatura: '2026-06' },
      ])
    })

    it('k fora de 1–n é recusado', () => {
      expect(() => schedule('2026-03-10', 10, 100000, 0)).toThrow(RangeError)
      expect(() => schedule('2026-03-10', 10, 100000, 11)).toThrow(RangeError)
      expect(() => schedule('2026-03-10', 10, 100000, 2.5)).toThrow(RangeError)
    })
  })

  it('respeita os limites de datas da base de dados (1900-01-01 a 2999-12-31)', () => {
    expect(() => schedule('1899-12-31', 1)).toThrow(RangeError)
    expect(() => schedule('2026-02-30', 1)).toThrow(RangeError)
    // 2999-11-10 à vista: fatura de dezembro de 2999, vence a 05/12 → ainda dentro
    expect(schedule('2999-11-10', 1).parcelas[0].mesFatura).toBe('2999-12')
    // 2 parcelas: a 2.ª venceria em janeiro de 3000
    expect(() => schedule('2999-11-10', 2)).toThrow(RangeError)
  })

  it('valores e configuração inválidos são recusados', () => {
    expect(() => schedule('2026-10-14', 3, 2)).toThrow(RangeError)
    expect(() =>
      installmentSchedule({
        dataCompra: '2026-10-14',
        totalCentavos: 1000,
        numeroParcelas: 1,
        config: config(10, 10),
      }),
    ).toThrow(RangeError)
  })
})

describe('invoiceStatus (com totais simulados)', () => {
  const fatura = (overrides: Partial<InvoiceStatusInput> = {}): InvoiceStatusInput => ({
    fechamento: '2026-10-25',
    vencimento: '2026-11-05',
    totalCentavos: 50000,
    pagoCentavos: 0,
    ...overrides,
  })

  it('aberta antes do fechamento, mesmo já com pagamentos', () => {
    expect(invoiceStatus(fatura(), '2026-10-24')).toEqual({
      estado: 'aberta',
      emAbertoCentavos: 50000,
    })
    expect(invoiceStatus(fatura({ pagoCentavos: 50000 }), '2026-10-24').estado).toBe('aberta')
    expect(invoiceStatus(fatura({ totalCentavos: 0 }), '2026-10-24').estado).toBe('aberta')
  })

  it('fechada do dia do fechamento até ao dia do vencimento (inclusive)', () => {
    expect(invoiceStatus(fatura(), '2026-10-25').estado).toBe('fechada')
    expect(invoiceStatus(fatura(), '2026-11-05').estado).toBe('fechada')
  })

  it('vencida a partir do dia seguinte ao vencimento, incluindo as pagas só em parte', () => {
    expect(invoiceStatus(fatura(), '2026-11-06').estado).toBe('vencida')
    expect(invoiceStatus(fatura({ pagoCentavos: 20000 }), '2026-11-06')).toEqual({
      estado: 'vencida',
      emAbertoCentavos: 30000,
    })
  })

  it('paga quando o valor em aberto chega a zero (antes ou depois do vencimento)', () => {
    expect(invoiceStatus(fatura({ pagoCentavos: 50000 }), '2026-10-30')).toEqual({
      estado: 'paga',
      emAbertoCentavos: 0,
    })
    expect(invoiceStatus(fatura({ pagoCentavos: 50000 }), '2026-12-01').estado).toBe('paga')
    // Pagamento parcial antes do vencimento: continua fechada, com o resto em aberto
    expect(invoiceStatus(fatura({ pagoCentavos: 49999 }), '2026-11-05')).toEqual({
      estado: 'fechada',
      emAbertoCentavos: 1,
    })
  })

  it('sem compras (total 0) e com crédito (total negativo) depois do fechamento', () => {
    expect(invoiceStatus(fatura({ totalCentavos: 0 }), '2026-11-10')).toEqual({
      estado: 'sem_compras',
      emAbertoCentavos: 0,
    })
    expect(invoiceStatus(fatura({ totalCentavos: -1500 }), '2026-10-25')).toEqual({
      estado: 'com_credito',
      emAbertoCentavos: -1500,
    })
  })

  it('pago a mais também é crédito (com ou sem compras)', () => {
    expect(invoiceStatus(fatura({ totalCentavos: 0, pagoCentavos: 5000 }), '2026-11-10')).toEqual({
      estado: 'com_credito',
      emAbertoCentavos: -5000,
    })
    expect(
      invoiceStatus(fatura({ totalCentavos: 10000, pagoCentavos: 15000 }), '2026-11-10'),
    ).toEqual({ estado: 'com_credito', emAbertoCentavos: -5000 })
  })

  it('crédito antes do fechamento: a fatura continua aberta', () => {
    expect(invoiceStatus(fatura({ totalCentavos: -1500 }), '2026-10-20')).toEqual({
      estado: 'aberta',
      emAbertoCentavos: -1500,
    })
  })

  it('recusa valores e datas inválidos', () => {
    expect(() => invoiceStatus(fatura({ totalCentavos: 10.5 }), '2026-10-25')).toThrow(TypeError)
    expect(() => invoiceStatus(fatura({ pagoCentavos: -1 }), '2026-10-25')).toThrow(RangeError)
    expect(() => invoiceStatus(fatura(), '2026-02-30')).toThrow(RangeError)
    expect(() =>
      invoiceStatus(fatura({ fechamento: '2026-11-05', vencimento: '2026-11-05' }), '2026-11-01'),
    ).toThrow(RangeError)
  })
})
