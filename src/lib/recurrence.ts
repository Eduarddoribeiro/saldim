import { addMonths, lastDayOfMonth, monthOf, type IsoDate } from './dates'

// Lançamentos recorrentes (Etapa R1, D15–D18 em docs/plano.md): as datas de cada repetição.
// Espelho de recorrencia_seguinte (migration recorrentes); tests/rls/recurring.test.ts confirma que dão
// o mesmo resultado.

export type Frequency = 'mensal' | 'anual'

const pad = (value: number) => String(value).padStart(2, '0')

/** O dia `day` do mês, ou o último dia se o mês for mais curto (31 em fevereiro → 28/29). */
export function dayInMonth(month: string, day: number): IsoDate {
  const last = Number(lastDayOfMonth(month).slice(8, 10))
  return `${month}-${pad(Math.min(day, last))}`
}

/**
 * Data seguinte a `date`: o mês seguinte (mensal) ou o mesmo mês do ano seguinte (anual), no dia `day`.
 * `day` é o dia pedido, não o de `date`: 31/01 → 28/02 → 31/03 (não 28/03).
 */
export function nextOccurrence(date: IsoDate, frequency: Frequency, day: number): IsoDate {
  return dayInMonth(addMonths(monthOf(date), frequency === 'anual' ? 12 : 1), day)
}

/** A primeira data da série (que passa por `date`) que não é anterior a `today`. Para retomar. */
export function nextOnOrAfter(
  date: IsoDate,
  frequency: Frequency,
  day: number,
  today: IsoDate,
): IsoDate {
  let next = date
  while (next < today) next = nextOccurrence(next, frequency, day)
  return next
}

/** As datas da série a partir de `from` (incluída) até `until` (incluída). */
export function occurrencesUntil(
  from: IsoDate,
  frequency: Frequency,
  day: number,
  until: IsoDate,
): IsoDate[] {
  const dates: IsoDate[] = []
  for (let next = from; next <= until; next = nextOccurrence(next, frequency, day)) {
    dates.push(next)
  }
  return dates
}

/** Dia do mês de uma data: é o "dia pedido" quando a pessoa escolhe a próxima data. */
export function dayOf(date: IsoDate): number {
  return Number(date.slice(8, 10))
}
