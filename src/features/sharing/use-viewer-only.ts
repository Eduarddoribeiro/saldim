import { useBalanceMovements } from '@/features/transactions/hooks'
import { useSharedDebts } from './hooks'

// Quem só usa o Saldim para ver o que deve (foi convidado e não tem lançamentos próprios) vê uma app
// simples: só "O que eu devo", sem barra de navegação, Extrato, Cartões nem o +. Pode escolher usar
// a app completa (fica guardado neste aparelho).

const FULL_APP_KEY = 'saldim-app-completo'

export function readFullApp(): boolean {
  try {
    return localStorage.getItem(FULL_APP_KEY) === '1'
  } catch {
    return false
  }
}

export function chooseFullApp() {
  try {
    localStorage.setItem(FULL_APP_KEY, '1')
  } catch {
    // Sem armazenamento: continua no modo simples
  }
}

/** true quando a conta só vê dívidas partilhadas (sem lançamentos próprios) e não pediu a app toda. */
export function useViewerOnly(): boolean {
  const debts = useSharedDebts()
  const hasDebts = (debts.data?.length ?? 0) > 0
  // Os lançamentos só se pedem a quem tem dívidas partilhadas (quase ninguém)
  const movements = useBalanceMovements({ enabled: hasDebts })
  return hasDebts && movements.data !== undefined && movements.data.length === 0 && !readFullApp()
}
