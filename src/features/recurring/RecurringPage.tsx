import { ArrowLeft, ChevronRight, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { useCurrency } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { useUpdateRecurring, useRecurring } from './hooks'
import type { Recurring } from './recurring-api'
import { describeSchedule, failureMessage, formatShortDate } from './recurring-options'
import { RecurringFormDialog } from './RecurringFormDialog'

export function RecurringPage() {
  const recurring = useRecurring()
  const accounts = useAccounts()
  const categories = useCategories()
  const currency = useCurrency()
  const dismiss = useUpdateRecurring()
  const [dialog, setDialog] = useState<{ open: boolean; recurring: Recurring | null }>({
    open: false,
    recurring: null,
  })

  const items = recurring.data ?? []
  // Ativas por próxima data; as pausadas no fim
  const sorted = [...items.filter((item) => item.ativa), ...items.filter((item) => !item.ativa)]
  const failures = items.filter((item) => item.falha && item.falha_data)
  const accountName = (id: string) => accounts.data?.find((account) => account.id === id)?.nome
  const category = (id: string) => categories.data?.find((item) => item.id === id)
  const error = recurring.error ?? accounts.error ?? categories.error

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
        <PageHeader
          title="Recorrentes"
          description="Assinaturas, contas fixas e salário: criados sozinhos quando chega o dia."
        />
        <Button
          size="lg"
          onClick={() => setDialog({ open: true, recurring: null })}
          className="max-sm:mb-3 max-sm:w-full"
        >
          <Plus aria-hidden />
          Novo recorrente
        </Button>
      </div>

      {failures.map((item) => (
        <div key={item.id} className="mb-3">
          <FormAlert>
            <strong className="font-medium">{item.descricao}:</strong>{' '}
            {failureMessage(item.falha!, item.falha_data!)}{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              disabled={dismiss.isPending}
              onClick={() =>
                dismiss.mutate({ id: item.id, patch: { falha: null, falha_data: null } })
              }
            >
              Dispensar
            </button>
          </FormAlert>
        </div>
      ))}

      {recurring.isPending || accounts.isPending || categories.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          A carregar recorrentes…
        </p>
      ) : error ? (
        <div className="grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button variant="outline" className="w-fit" onClick={() => recurring.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Ainda sem recorrentes"
          description="Cria um para a Netflix, a renda ou o salário: o lançamento aparece sozinho em cada mês."
        />
      ) : (
        <ul aria-label="Recorrentes" className="divide-y rounded-xl border">
          {sorted.map((item) => {
            const itemCategory = category(item.category_id)
            const isCredit = item.tipo === 'receita'
            const amount = formatMoney(
              isCredit ? item.valor_centavos : -item.valor_centavos,
              currency,
              {
                signDisplay: 'always',
              },
            )
            const schedule = describeSchedule(item.frequencia, item.dia, item.proxima_data)
            const next = item.ativa ? `Próximo: ${formatShortDate(item.proxima_data)}` : 'Pausado'
            const details = [schedule, accountName(item.account_id)].filter(Boolean).join(' · ')
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, recurring: item })}
                  aria-label={`${item.descricao}: ${amount}, ${details}. ${next}. Editar`}
                  className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
                >
                  <CategoryBadge
                    cor={itemCategory?.cor ?? 'slate'}
                    icone={itemCategory?.icone ?? 'tag'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.descricao}</span>
                    <span className="block text-xs text-muted-foreground">{details}</span>
                    <span
                      className={
                        item.ativa
                          ? 'block text-xs text-muted-foreground'
                          : 'block text-xs font-medium text-amber-700 dark:text-amber-400'
                      }
                    >
                      {next}
                    </span>
                  </span>
                  <span
                    className={
                      isCredit
                        ? 'shrink-0 font-medium text-emerald-700 tabular-nums dark:text-emerald-400'
                        : 'shrink-0 font-medium tabular-nums'
                    }
                  >
                    {amount}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <RecurringFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        recurring={dialog.recurring}
        categories={categories.data ?? []}
        accounts={accounts.data ?? []}
      />
    </>
  )
}
