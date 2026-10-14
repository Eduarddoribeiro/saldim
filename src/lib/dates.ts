// Datas no Saldo: as transações guardam só o dia ('YYYY-MM-DD', tipo `date` no Postgres) e os meses
// identificam-se por 'YYYY-MM'. Trabalhamos com texto e números, sem horas, para não haver surpresas de
// fuso horário. Regra do período em docs/plano.md: mês = data >= dia 1 e < dia 1 do mês seguinte.

export type IsoDate = string // 'YYYY-MM-DD'
export type MonthKey = string // 'YYYY-MM'

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Data LOCAL de hoje. (Não usar `new Date().toISOString()`: dá a data em UTC e, perto da meia-noite,
 * pode devolver o dia anterior ou seguinte.)
 */
export function todayIso(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7)
}

export function currentMonth(now: Date = new Date()): MonthKey {
  return monthOf(todayIso(now))
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Recusa datas impossíveis como 2026-02-30 (o Date "transbordaria" para março)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [year, monthIndex] = month.split('-').map(Number)
  const total = year * 12 + (monthIndex - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/** Intervalo [from, to) do mês, pronto para filtrar: data >= from e data < to. */
export function monthRange(month: MonthKey): { from: IsoDate; to: IsoDate } {
  return { from: `${month}-01`, to: `${addMonths(month, 1)}-01` }
}

/** 'outubro de 2026' */
export function formatMonth(month: MonthKey): string {
  const [year, monthIndex] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex - 1, 1),
  )
}

/** 'terça-feira, 14 de outubro' (com o ano só se não for o ano de referência) */
export function formatDay(date: IsoDate, referenceYear = new Date().getFullYear()): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(year !== referenceYear ? { year: 'numeric' } : {}),
  }).format(new Date(year, month - 1, day))
}
