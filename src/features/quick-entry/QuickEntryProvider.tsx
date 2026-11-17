import { useCallback, useState, type ReactNode } from 'react'
import { QuickEntryContext, type QuickEntryOptions } from './quick-entry-context'
import { QuickEntrySheet } from './QuickEntrySheet'

/** Dá a toda a app o `+` (lançamento rápido) e mostra a folha quando é pedida. */
export function QuickEntryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; options: QuickEntryOptions }>({
    open: false,
    options: {},
  })
  const open = useCallback(
    (options: QuickEntryOptions = {}) => setState({ open: true, options }),
    [],
  )
  return (
    <QuickEntryContext value={open}>
      {children}
      <QuickEntrySheet
        open={state.open}
        options={state.options}
        onOpenChange={(isOpen) => setState((current) => ({ ...current, open: isOpen }))}
      />
    </QuickEntryContext>
  )
}
