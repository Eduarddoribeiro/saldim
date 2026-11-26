import { describe, expect, it } from 'vitest'
import {
  dailyVariableSpending,
  forecastUntil,
  receivableEvents,
  type ForecastEvent,
} from './forecast'

const ev = (
  data: string,
  kind: ForecastEvent['kind'],
  valor: number,
  descricao: string = kind,
) => ({
  data,
  kind,
  valor,
  descricao,
})

const base = {
  today: '2026-11-26',
  until: '2026-12-31',
  disponivel: 38007,
  dailySpending: 0,
  events: [
    ev('2026-12-05', 'entrada', 100000, 'Salário'),
    ev('2026-12-07', 'fatura', -139418, 'Fatura Nubank'),
    ev('2026-12-07', 'receber', 48880, 'Mãe'),
    ev('2026-12-12', 'conta', -5500, 'Corte de cabelo'),
    ev('2026-12-01', 'conta', -2000, 'Atrasada'),
    ev('2027-01-05', 'entrada', 100000, 'Salário de janeiro'), // depois do fim: não conta
    ev('2026-11-20', 'receber', 11980, 'Mãe (atrasado)'), // antes de hoje: conta como hoje
  ],
}

describe('forecastUntil', () => {
  it('soma o que entra e o que sai até ao fim do mês que vem', () => {
    const result = forecastUntil(base)
    expect([result.entradas, result.receber, result.faturas, result.conta]).toEqual([
      100000, 60860, 139418, 7500,
    ])
    // 380,07 + 1.000 + 608,60 − 1.394,18 − 75 = 519,49
    expect(result.sobra).toBe(51949)
    expect(result.timeline.at(-1)?.saldo).toBe(51949)
  })

  it('ordena por data (o atrasado conta hoje) e acha o dia mais apertado', () => {
    const result = forecastUntil(base)
    expect(result.timeline.map((step) => [step.data, step.descricao])).toEqual([
      ['2026-11-26', 'Mãe (atrasado)'],
      ['2026-12-01', 'Atrasada'],
      ['2026-12-05', 'Salário'],
      ['2026-12-07', 'Mãe'], // no mesmo dia, o que entra primeiro
      ['2026-12-07', 'Fatura Nubank'],
      ['2026-12-12', 'Corte de cabelo'],
    ])
    // Nunca fica abaixo do que tem hoje
    expect(result.menor).toEqual({ data: '2026-11-26', saldo: 38007 })
  })

  it('sem o que vão te pagar, a sobra cai (e pode faltar dinheiro)', () => {
    const result = forecastUntil({ ...base, includeReceber: false })
    expect(result.receber).toBe(0)
    expect(result.sobra).toBe(51949 - 60860)
    // Fica negativo no dia da fatura e mais ainda depois do corte
    expect(result.timeline.find((step) => step.kind === 'fatura')?.saldo).toBe(-3411)
    expect(result.menor).toEqual({ data: '2026-12-12', saldo: -8911 })
  })

  it('desconta o dia a dia de amanhã até ao fim', () => {
    const result = forecastUntil({ ...base, dailySpending: 1000 })
    // 35 dias (27/11 a 31/12)
    expect(result.diaADia).toBe(35000)
    expect(result.sobraComDiaADia).toBe(51949 - 35000)
  })
})

describe('dailyVariableSpending', () => {
  it('o que passa dos fixos, por dia; nunca negativo', () => {
    expect(dailyVariableSpending(145000, 68207)).toBeCloseTo((145000 - 68207) / 30)
    expect(dailyVariableSpending(50000, 68207)).toBe(0)
  })
})

describe('receivableEvents', () => {
  const months = [
    {
      month: '2026-12',
      ultimoVencimento: '2026-12-07',
      pessoas: [{ pessoaId: 'mae', centavos: 48880 }],
    },
    {
      month: '2027-01',
      ultimoVencimento: '2027-01-07',
      pessoas: [{ pessoaId: 'mae', centavos: 29980 }],
    },
  ]
  const name = () => 'Mãe'

  it('o atrasado hoje e a parte de cada fatura no vencimento, até ao fim do mês que vem', () => {
    expect(
      receivableEvents({
        people: [{ pessoaId: 'mae', total: 120820, vencido: 11980 }],
        months,
        until: '2026-12-31',
        today: '2026-11-26',
        name,
      }),
    ).toEqual([
      { data: '2026-11-26', kind: 'receber', descricao: 'Mãe (atrasado)', valor: 11980 },
      { data: '2026-12-07', kind: 'receber', descricao: 'Mãe', valor: 48880 },
    ])
  })

  it('nunca mais do que a pessoa deve (pagou adiantado)', () => {
    const events = receivableEvents({
      people: [{ pessoaId: 'mae', total: 20000, vencido: 0 }],
      months,
      until: '2027-01-31',
      today: '2026-11-26',
      name,
    })
    expect(events.map((event) => event.valor)).toEqual([20000])
  })
})
