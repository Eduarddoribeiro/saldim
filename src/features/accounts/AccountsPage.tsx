import { ArrowLeft, ChevronRight, Landmark, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { TIPO_CONTA_OPTIONS } from './account-options'
import type { Account } from './accounts-api'
import { AccountFormDialog } from './AccountFormDialog'
import { useAccounts } from './hooks'

export function AccountsPage() {
  const { data: accounts, isPending, error, refetch } = useAccounts()
  const currency = useCurrency()
  const [dialog, setDialog] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  })

  const active = (accounts ?? []).filter((account) => !account.arquivada)
  const archived = (accounts ?? []).filter((account) => account.arquivada)
  const openEdit = (account: Account) => setDialog({ open: true, account })

  return (
    <>
      <Link
        to="/configuracoes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Configurações
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Contas" description="Bancos, poupanças e dinheiro que tens." />
        <Button
          size="lg"
          onClick={() => setDialog({ open: true, account: null })}
          className="max-sm:mb-3 max-sm:w-full"
        >
          <Plus aria-hidden />
          Nova conta
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          A carregar contas…
        </p>
      ) : error ? (
        <div className="grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button variant="outline" className="w-fit" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Ainda sem contas"
          description="Cria uma conta para começares a registar movimentos."
        />
      ) : (
        <section aria-label="Contas ativas">
          <AccountList accounts={active} currency={currency} onSelect={openEdit} />
          {archived.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
                Arquivadas ({archived.length})
              </summary>
              <AccountList
                accounts={archived}
                currency={currency}
                onSelect={openEdit}
                className="mt-2 opacity-70"
              />
            </details>
          )}
        </section>
      )}

      <AccountFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        account={dialog.account}
      />
    </>
  )
}

function AccountList({
  accounts,
  currency,
  onSelect,
  className,
}: {
  accounts: Account[]
  currency: Currency
  onSelect: (account: Account) => void
  className?: string
}) {
  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Todas as contas estão arquivadas.</p>
  }
  return (
    <ul className={cn('divide-y rounded-xl border', className)}>
      {accounts.map((account) => {
        const { icon: Icon, label } = TIPO_CONTA_OPTIONS[account.tipo]
        return (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onSelect(account)}
              aria-label={`Editar ${account.nome}: ${label}, saldo inicial ${formatMoney(account.saldo_inicial_centavos, currency)}`}
              className="flex min-h-16 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{account.nome}</span>
                <span className="block text-xs text-muted-foreground">{label}</span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-muted-foreground">Saldo inicial</span>
                <span className="block text-sm font-medium tabular-nums">
                  {formatMoney(account.saldo_inicial_centavos, currency)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
