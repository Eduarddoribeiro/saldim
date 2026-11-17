import { createContext, useContext } from 'react'
import type { Tipo } from '@/features/categories/schemas'

export type QuickEntryOptions = {
  /** Receita ou despesa ao abrir (por omissão, despesa) */
  tipo?: Tipo
  /** Abre já com um cartão escolhido (compra no cartão) */
  card?: boolean
}

/** Abre o lançamento rápido (o `+`); disponível em todas as páginas da app (AppShell). */
export const QuickEntryContext = createContext<((options?: QuickEntryOptions) => void) | null>(null)

export function useQuickEntry() {
  const open = useContext(QuickEntryContext)
  if (!open) throw new Error('useQuickEntry precisa do QuickEntryProvider (no AppShell).')
  return open
}
