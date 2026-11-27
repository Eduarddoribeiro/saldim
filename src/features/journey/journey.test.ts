import { describe, expect, it } from 'vitest'
import {
  badgesOf,
  bestStreak,
  currentStreak,
  fullWeeks,
  levelOf,
  reserveMilestones,
  starsOf,
  weekStart,
  weeklyChallenge,
  challengesDone,
  type JourneyFacts,
} from './journey'

const days = (...list: string[]) => new Set(list)
// 26/11/2026 é uma quinta-feira; a semana começa na segunda 23/11
const today = '2026-11-26'

describe('weekStart', () => {
  it('segunda-feira da semana (domingo é o último dia)', () => {
    expect(weekStart('2026-11-26')).toBe('2026-11-23')
    expect(weekStart('2026-11-23')).toBe('2026-11-23')
    expect(weekStart('2026-11-29')).toBe('2026-11-23')
    expect(weekStart('2026-11-30')).toBe('2026-11-30')
  })
})

describe('currentStreak', () => {
  it('conta os dias seguidos até hoje', () => {
    expect(currentStreak(days('2026-11-24', '2026-11-25', '2026-11-26'), today)).toEqual({
      atual: 3,
      folgas: [],
      hojeFechado: true,
    })
  })

  it('hoje ainda aberto não quebra: conta até ontem', () => {
    expect(currentStreak(days('2026-11-24', '2026-11-25'), today).atual).toBe(2)
  })

  it('um dia esquecido por semana é folga; o segundo na mesma semana quebra', () => {
    // dom 22 esquecido (folga da semana de 16/11), seg 23 fechado, ter 24 esquecido (folga da semana de 23/11)
    const one = currentStreak(
      days('2026-11-20', '2026-11-21', '2026-11-23', '2026-11-25', '2026-11-26'),
      today,
    )
    expect(one).toEqual({ atual: 5, folgas: ['2026-11-24', '2026-11-22'], hojeFechado: true })
    // dois esquecidos na mesma semana (24 e 25): para no 24
    expect(currentStreak(days('2026-11-23', '2026-11-26'), today).atual).toBe(1)
  })

  it('sem dias fechados, zero', () => {
    expect(currentStreak(days(), today)).toEqual({ atual: 0, folgas: [], hojeFechado: false })
  })
})

describe('bestStreak e fullWeeks', () => {
  it('a maior sequência guarda-se mesmo depois de quebrar', () => {
    const closed = days(
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-20',
    )
    expect(bestStreak(closed, today)).toBe(7)
    expect(currentStreak(closed, today).atual).toBe(0)
    expect(fullWeeks(closed, today)).toEqual(['2026-11-02'])
  })

  it('a semana de hoje ainda não conta como completa', () => {
    const closed = days(
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    )
    expect(fullWeeks(closed, '2026-11-28')).toEqual([])
  })
})

describe('estrelas, níveis e conquistas', () => {
  const facts: JourneyFacts = {
    closedDays: ['2026-11-24', '2026-11-25', '2026-11-26'],
    desafios: 1,
    depositosReserva: 2,
    faturasEmDia: 1,
    mesesAzul: 1,
    guardado: 55676,
    gastoMensal: 145000,
  }

  it('soma cada coisa feita e os marcos da reserva atingidos', () => {
    const { lines, total } = starsOf(facts, today)
    expect(Object.fromEntries(lines.map((row) => [row.id, row.total]))).toEqual({
      dia: 3,
      semana: 0,
      desafio: 5,
      reserva: 6,
      fatura: 2,
      mes: 10,
      marcos: 10, // R$ 100 e R$ 500
    })
    expect(total).toBe(36)
  })

  it('nível e progresso até o seguinte', () => {
    expect(levelOf(0)).toMatchObject({ nivel: 1, nome: 'Começando', progresso: 0 })
    expect(levelOf(86)).toMatchObject({ nivel: 2, nome: 'Atento' })
    expect(levelOf(86).progresso).toBeCloseTo(36 / 100)
    expect(levelOf(5000)).toMatchObject({ nivel: 5, proximo: null, progresso: 1 })
  })

  it('marcos da reserva pela meta de 3 meses de gastos', () => {
    expect(reserveMilestones(145000).map((marco) => marco.valor)).toEqual([
      10000, 50000, 145000, 435000,
    ])
    // Sem gastos ainda: só os marcos fixos
    expect(reserveMilestones(0)).toHaveLength(2)
  })

  it('conquistas ganhas e o que falta nas outras', () => {
    const badges = badgesOf(facts, today, 36)
    const byId = Object.fromEntries(badges.map((badge) => [badge.id, badge]))
    expect(badges).toHaveLength(12)
    expect(byId['estrela'].ganha).toBe(true)
    expect(byId['seq-7']).toMatchObject({ ganha: false, falta: 'faltam 4' })
    expect(byId['reserva-1'].ganha).toBe(true)
    expect(byId['reserva-2'].ganha).toBe(false)
  })
})

describe('desafio da semana', () => {
  const row = (data: string, valor: number, descricao = 'Mercado') => ({
    tipo: 'despesa',
    valor_centavos: valor,
    data,
    descricao,
    pessoa_id: null,
    compra_id: null,
    recorrencia_id: null,
  })
  const filter = (history: ReturnType<typeof row>[]) => ({
    history,
    installmentIds: new Set<string>(),
    fixedKeys: new Set(['faculdade']),
    key: (descricao: string) => descricao.toLowerCase(),
  })

  it('limite = 90% do ritmo dos 30 dias antes; cumprido só quando a semana acaba', () => {
    // 30 dias antes de 16/11 (17/10 a 15/11): R$ 600 → R$ 20/dia → limite 0,9 × 7 × 20 = R$ 126
    const history = [
      row('2026-10-20', 30000),
      row('2026-11-10', 30000),
      row('2026-11-10', 32457, 'Faculdade'),
    ]
    const week = weeklyChallenge(
      filter([...history, row('2026-11-18', 10000)]),
      '2026-11-16',
      today,
    )
    expect(week).toEqual({ semana: '2026-11-16', limite: 12600, gasto: 10000, cumprido: true })
    const over = weeklyChallenge(
      filter([...history, row('2026-11-18', 20000)]),
      '2026-11-16',
      today,
    )
    expect(over.cumprido).toBe(false)
    // A semana de hoje ainda não acabou
    expect(weeklyChallenge(filter(history), '2026-11-23', today).cumprido).toBe(false)
  })

  it('conta as semanas cumpridas desde o primeiro dia fechado', () => {
    const history = [row('2026-10-20', 30000), row('2026-11-10', 30000), row('2026-11-18', 10000)]
    expect(challengesDone(filter(history), ['2026-11-17'], today)).toBe(1)
    expect(challengesDone(filter(history), [], today)).toBe(0)
  })
})
