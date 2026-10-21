import type { IsoDate } from '@/lib/dates'
import type { Frequency } from '@/lib/recurrence'

// Textos dos lançamentos recorrentes (funções puras, testadas sem React).

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

/** '10/11/2026' */
export function formatShortDate(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}

/** 'Todo dia 10', 'Todo dia 31 (ou o último dia do mês)', 'Todos os anos a 15 de março' */
export function describeSchedule(frequency: Frequency, day: number, nextDate: IsoDate): string {
  if (frequency === 'anual') {
    const [year, month] = nextDate.split('-').map(Number)
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
      new Date(year, month - 1, 1),
    )
    // 29 de fevereiro num ano normal: a data guardada já é a 28
    return `Todo ano em ${day} de ${monthName}`
  }
  return day >= 29 ? `Todo dia ${day} (ou o último dia do mês)` : `Todo dia ${day}`
}

// Regras que podem recusar um lançamento ao ser criado (HINT guardado em recorrencias.falha)
const FAILURE_REASONS: Record<string, string> = {
  recorrencias_arquivada_check: 'a conta ou a categoria está arquivada',
  recorrencias_cartao_check: 'em um cartão de crédito só há despesas',
  compras_cartao_conta_check: 'a conta deixou de ser um cartão de crédito',
  compras_cartao_categoria_check: 'a categoria não é de despesa',
  transactions_conta_cartao_check: 'a conta passou a ser um cartão de crédito',
}

/** Aviso de um lançamento que não foi criado. */
export function failureMessage(code: string, date: IsoDate): string {
  const reason = FAILURE_REASONS[code] ?? 'foi recusado'
  return `O lançamento de ${formatShortDate(date)} não foi criado: ${reason}. Se precisar, registre manualmente.`
}
