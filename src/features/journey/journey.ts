import { variableSpending, type VariableFilter } from '@/features/forecast/forecast'
import { addDays, daysBetween, type IsoDate } from '@/lib/dates'

// Sequência, estrelas, níveis e conquistas (pedido de 2026-11-26; docs/features/jornada.md). Tudo é
// calculado a partir de factos que já existem (dias fechados, transferências para a reserva,
// faturas pagas, meses no azul): não se guardam pontos que possam ficar errados. Funções puras.

/** Estrelas por cada coisa feita */
export const STARS = {
  dia: 1,
  semana: 3,
  desafio: 5,
  reserva: 3,
  fatura: 2,
  mesAzul: 10,
} as const
export const RESERVE_STARS = STARS.reserva

/** Segunda-feira da semana de `date` (as semanas vão de segunda a domingo). */
export function weekStart(date: IsoDate): IsoDate {
  const [year, month, day] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = domingo
  return addDays(date, -((dow + 6) % 7))
}

export type Streak = {
  /** Dias seguidos (os dias de folga não somam, mas não quebram) */
  atual: number
  /** Dias de folga usados na sequência atual (um por semana, no máximo) */
  folgas: IsoDate[]
  hojeFechado: boolean
}

/**
 * A sequência atual: de hoje (ou de ontem, se hoje ainda não foi fechado) para trás, contando os dias
 * fechados. Um dia sem fechar por semana é uma folga e não quebra a sequência; o segundo quebra.
 */
export function currentStreak(closed: ReadonlySet<IsoDate>, today: IsoDate): Streak {
  const hojeFechado = closed.has(today)
  const first = [...closed].sort()[0]
  if (!first) return { atual: 0, folgas: [], hojeFechado }
  const usedWeeks = new Set<IsoDate>()
  let folgas: IsoDate[] = []
  let atual = 0
  let oldestCounted: IsoDate | null = null
  for (let day = hojeFechado ? today : addDays(today, -1); day >= first; day = addDays(day, -1)) {
    if (closed.has(day)) {
      atual += 1
      oldestCounted = day
    } else if (!usedWeeks.has(weekStart(day))) {
      usedWeeks.add(weekStart(day))
      folgas.push(day)
    } else break
  }
  // Uma folga mais antiga do que o primeiro dia contado não segura nada
  folgas = oldestCounted ? folgas.filter((day) => day > oldestCounted) : []
  return { atual, folgas, hojeFechado }
}

/** A maior sequência de sempre (as mesmas regras, do primeiro dia fechado até hoje). */
export function bestStreak(closed: ReadonlySet<IsoDate>, today: IsoDate): number {
  const first = [...closed].sort()[0]
  if (!first) return 0
  let best = 0
  let run = 0
  let usedWeeks = new Set<IsoDate>()
  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (closed.has(day)) {
      run += 1
      best = Math.max(best, run)
    } else if (day === today) {
      // Hoje ainda pode ser fechado: não quebra nada
    } else if (!usedWeeks.has(weekStart(day))) {
      usedWeeks.add(weekStart(day))
    } else {
      run = 0
      usedWeeks = new Set()
    }
  }
  return best
}

/** Semanas já acabadas (segunda a domingo, antes da semana de hoje) com 6 ou 7 dias fechados. */
export function fullWeeks(closed: ReadonlySet<IsoDate>, today: IsoDate): IsoDate[] {
  const byWeek = new Map<IsoDate, number>()
  for (const day of closed) {
    const week = weekStart(day)
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1)
  }
  const thisWeek = weekStart(today)
  return [...byWeek]
    .filter(([week, count]) => week < thisWeek && count >= 6)
    .map(([week]) => week)
    .sort()
}

export const LEVELS = [
  { nivel: 1, nome: 'Começando', desde: 0 },
  { nivel: 2, nome: 'Atento', desde: 50 },
  { nivel: 3, nome: 'Organizado', desde: 150 },
  { nivel: 4, nome: 'Planejador', desde: 400 },
  { nivel: 5, nome: 'Investidor', desde: 1000 },
] as const

/** O nível das estrelas e quanto falta para o seguinte (null no último). */
export function levelOf(stars: number) {
  const index = LEVELS.findLastIndex((level) => stars >= level.desde)
  const current = LEVELS[Math.max(0, index)]
  const next = LEVELS[index + 1] ?? null
  return {
    ...current,
    proximo: next,
    progresso: next ? (stars - current.desde) / (next.desde - current.desde) : 1,
  }
}

/** Marcos da reserva: valor (centavos), nome e estrelas. A meta vem do gasto do mês. */
export function reserveMilestones(monthlySpending: number) {
  const marcos = [
    { valor: 10000, nome: 'Primeiro passo', estrelas: 5 },
    { valor: 50000, nome: 'Segura um imprevisto pequeno', estrelas: 5 },
    { valor: monthlySpending, nome: '1 mês de gastos', estrelas: 10 },
    { valor: monthlySpending * 3, nome: 'Reserva completa', estrelas: 30 },
  ]
  // Sem gastos ainda (ou gasto muito baixo), os marcos do mês não fazem sentido
  return marcos.filter((marco, index) => index < 2 || marco.valor > 50000)
}

export type JourneyFacts = {
  closedDays: readonly IsoDate[]
  /** Desafios da semana cumpridos (semanas acabadas) */
  desafios: number
  /** Transferências para uma conta Poupança/Investimentos */
  depositosReserva: number
  /** Faturas pagas até ao vencimento */
  faturasEmDia: number
  /** Meses acabados em que entrou mais do que saiu */
  mesesAzul: number
  /** Quanto está nas contas de guardar hoje */
  guardado: number
  /** Gasto médio do mês (para os marcos da reserva) */
  gastoMensal: number
}

export type StarLine = { id: string; label: string; vezes: number; cada: number; total: number }

/** As estrelas, linha a linha (de onde vieram) e no total. */
export function starsOf(facts: JourneyFacts, today: IsoDate) {
  const closed = new Set(facts.closedDays)
  const marcos = reserveMilestones(facts.gastoMensal).filter(
    (marco) => facts.guardado >= marco.valor,
  )
  const lines: StarLine[] = [
    line('dia', 'Dias fechados', closed.size, STARS.dia),
    line('semana', 'Semanas completas', fullWeeks(closed, today).length, STARS.semana),
    line('desafio', 'Desafios da semana', facts.desafios, STARS.desafio),
    line('reserva', 'Depósitos na reserva', facts.depositosReserva, STARS.reserva),
    line('fatura', 'Faturas pagas em dia', facts.faturasEmDia, STARS.fatura),
    line('mes', 'Meses no azul', facts.mesesAzul, STARS.mesAzul),
    {
      id: 'marcos',
      label: 'Marcos da reserva',
      vezes: marcos.length,
      cada: 0,
      total: marcos.reduce((sum, marco) => sum + marco.estrelas, 0),
    },
  ]
  return { lines, total: lines.reduce((sum, row) => sum + row.total, 0) }
}

function line(id: string, label: string, vezes: number, cada: number): StarLine {
  return { id, label, vezes, cada, total: vezes * cada }
}

export type Badge = { id: string; nome: string; ganha: boolean; falta?: string }

/** As conquistas, ganhas e por ganhar (com o que falta). */
export function badgesOf(facts: JourneyFacts, today: IsoDate, stars: number): Badge[] {
  const closed = new Set(facts.closedDays)
  const best = Math.max(bestStreak(closed, today), currentStreak(closed, today).atual)
  const money = (cents: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(cents / 100)
  const streakBadge = (dias: number): Badge => ({
    id: `seq-${dias}`,
    nome: `${dias} dias seguidos`,
    ganha: best >= dias,
    falta: best >= dias ? undefined : `faltam ${dias - best}`,
  })
  const reserve = reserveMilestones(facts.gastoMensal)
  const reserveBadge = (index: number): Badge | null => {
    const marco = reserve[index]
    if (!marco) return null
    return {
      id: `reserva-${index}`,
      nome: index === 0 ? 'Primeiros R$ 100' : index === 1 ? 'R$ 500 guardados' : marco.nome,
      ganha: facts.guardado >= marco.valor,
      falta: facts.guardado >= marco.valor ? undefined : money(marco.valor),
    }
  }
  const badges: (Badge | null)[] = [
    {
      id: 'estrela',
      nome: 'Primeira estrela',
      ganha: stars > 0,
      falta: stars > 0 ? undefined : 'feche o dia',
    },
    streakBadge(7),
    {
      id: 'fatura',
      nome: 'Fatura em dia',
      ganha: facts.faturasEmDia > 0,
      falta: facts.faturasEmDia > 0 ? undefined : 'pague antes do vencimento',
    },
    {
      id: 'mes',
      nome: 'Mês no azul',
      ganha: facts.mesesAzul > 0,
      falta: facts.mesesAzul > 0 ? undefined : 'gaste menos do que entra',
    },
    {
      id: 'desafio',
      nome: 'Desafio cumprido',
      ganha: facts.desafios > 0,
      falta: facts.desafios > 0 ? undefined : 'segure o dia a dia',
    },
    {
      id: 'deposito',
      nome: 'Primeiro depósito',
      ganha: facts.depositosReserva > 0,
      falta: facts.depositosReserva > 0 ? undefined : 'guarde na reserva',
    },
    reserveBadge(0),
    reserveBadge(1),
    reserveBadge(2),
    reserveBadge(3),
    streakBadge(30),
    streakBadge(100),
  ]
  return badges.filter((badge): badge is Badge => badge !== null)
}

/** Quantos dias faltam para o domingo desta semana (0 no domingo). */
export function daysLeftInWeek(today: IsoDate): number {
  return 6 - daysBetween(weekStart(today), today)
}

export type WeeklyChallenge = {
  semana: IsoDate
  /** Até quanto gastar no dia a dia nesta semana: 90% do ritmo dos 30 dias antes dela */
  limite: number
  gasto: number
  cumprido: boolean
}

/**
 * O desafio de uma semana: gastar no dia a dia menos do que 90% do seu ritmo (os 30 dias antes da
 * semana). Sem gastos antes, não há desafio (limite 0, nunca cumprido).
 */
export function weeklyChallenge(
  filter: VariableFilter,
  semana: IsoDate,
  today: IsoDate,
): WeeklyChallenge {
  const before = addDays(semana, -1)
  const limite = Math.round(0.9 * 7 * (variableSpending(filter, addDays(before, -29), before) / 30))
  const fim = addDays(semana, 6)
  const gasto = variableSpending(filter, semana, fim < today ? fim : today)
  return { semana, limite, gasto, cumprido: limite > 0 && gasto <= limite && fim < today }
}

/** Desafios cumpridos nas semanas acabadas, desde a semana do primeiro dia fechado. */
export function challengesDone(
  filter: VariableFilter,
  closedDays: readonly IsoDate[],
  today: IsoDate,
): number {
  const first = [...closedDays].sort()[0]
  if (!first) return 0
  let count = 0
  for (let semana = weekStart(first); semana < weekStart(today); semana = addDays(semana, 7)) {
    if (weeklyChallenge(filter, semana, today).cumprido) count += 1
  }
  return count
}
