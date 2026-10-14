import { useSearchParams } from 'react-router'
import { currentMonth, isMonthKey, type MonthKey } from '@/lib/dates'

/**
 * Mês selecionado guardado no endereço (?mes=2026-10): sobrevive a recarregar a página e pode ser
 * partilhado entre a lista de transações e o início. Valor ausente ou inválido → mês atual.
 */
export function useMonthParam(): [MonthKey, (month: MonthKey) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get('mes')
  const month = isMonthKey(value) ? value : currentMonth()

  const setMonth = (next: MonthKey) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current)
        if (next === currentMonth()) updated.delete('mes')
        else updated.set('mes', next)
        return updated
      },
      { replace: true },
    )

  return [month, setMonth]
}
