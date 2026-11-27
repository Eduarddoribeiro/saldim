import { useCallback, useState, type ReactNode } from 'react'
import { QuickEntryContext, type QuickEntryOptions } from './quick-entry-context'
import { TransferSheet } from '@/features/transfers/TransferSheet'
import { QuickEntrySheet } from './QuickEntrySheet'

/** Dá a toda a app o `+` (lançamento rápido, ou a transferência entre contas) e mostra a folha. */
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
        open={state.open && !state.options.transfer}
        options={state.options}
        onOpenChange={(isOpen) => setState((current) => ({ ...current, open: isOpen }))}
      />
      <TransferSheet
        open={state.open && Boolean(state.options.transfer)}
        preset={state.options.transfer}
        onOpenChange={(isOpen) => setState((current) => ({ ...current, open: isOpen }))}
      />
    </QuickEntryContext>
  )
}
