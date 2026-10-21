import { HandCoins, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDeleteButton } from '@/components/form/ConfirmDeleteButton'
import { FormAlert } from '@/components/form/FormAlert'
import { useServerAction } from '@/components/form/use-server-action'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import { useCategories } from '@/features/categories/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import type { Receivable } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useDeleteReimbursement, usePeople } from './hooks'
import type { Person, Reimbursement } from './people-api'
import { PersonDebtDetails } from './PersonDebtDetails'
import { PersonFormDialog } from './PersonFormDialog'
import type { DetailMovement } from './receivable-details'
import { ReimbursementFormDialog } from './ReimbursementFormDialog'
import { useReceivables } from './use-receivables'

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

/** Página "A receber" (T1): o que cada pessoa deve, as suas compras e o que já devolveu. */
export function ReceivablesPage() {
  const people = usePeople()
  const receivables = useReceivables()
  const purchases = usePurchases()
  const accounts = useAccounts()
  const currency = useCurrency()
  const [personDialog, setPersonDialog] = useState<{ open: boolean; person: Person | null }>({
    open: false,
    person: null,
  })
  const [payDialog, setPayDialog] = useState<{
    open: boolean
    person: Person | null
    suggested: number
  }>({ open: false, person: null, suggested: 0 })

  const queries = [people, receivables, purchases, accounts]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error

  const byPerson = new Map(receivables.data.map((row) => [row.pessoaId, row]))
  const all = people.data ?? []
  // Arquivadas só aparecem se ainda houver contas por acertar
  const visible = all.filter((person) => !person.arquivada || (byPerson.get(person.id)?.total ?? 0))
  const archived = all.filter((person) => person.arquivada && !visible.includes(person))

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="A receber"
          description="Compras de outras pessoas no seu cartão e o que já te devolveram."
        />
        <Button
          size="lg"
          onClick={() => setPersonDialog({ open: true, person: null })}
          className="max-sm:mb-3 max-sm:w-full"
        >
          <Plus aria-hidden />
          Nova pessoa
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Carregando o que te devem…
        </p>
      ) : error ? (
        <div className="grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => queries.forEach((query) => void query.refetch())}
          >
            Tentar de novo
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Ninguém te deve nada"
          description="Ao registrar uma compra no cartão, escolha de quem ela é em “De quem é a compra?”."
        />
      ) : (
        <div className="grid gap-4">
          {visible.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              receivable={byPerson.get(person.id)}
              purchases={(purchases.data ?? []).filter((item) => item.pessoa_id === person.id)}
              reimbursements={(receivables.reimbursements.data ?? []).filter(
                (item) => item.pessoa_id === person.id,
              )}
              accountName={(id) => accounts.data?.find((account) => account.id === id)?.nome}
              accounts={accounts.data ?? []}
              movements={receivables.movements}
              dueInvoiceIds={receivables.dueInvoiceIds}
              currency={currency}
              onEdit={() => setPersonDialog({ open: true, person })}
              onPay={(suggested) => setPayDialog({ open: true, person, suggested })}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
            Pessoas arquivadas ({archived.length})
          </summary>
          <ul className="mt-2 divide-y rounded-xl border opacity-70">
            {archived.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setPersonDialog({ open: true, person })}
                  className="flex min-h-12 w-full items-center px-3 text-left hover:bg-muted/50"
                >
                  {person.nome}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <PersonFormDialog
        open={personDialog.open}
        onOpenChange={(open) => setPersonDialog((current) => ({ ...current, open }))}
        person={personDialog.person}
      />
      <ReimbursementFormDialog
        open={payDialog.open}
        onOpenChange={(open) => setPayDialog((current) => ({ ...current, open }))}
        person={payDialog.person}
        accounts={accounts.data ?? []}
        suggestedCents={payDialog.suggested}
      />
    </>
  )
}

function PersonCard({
  person,
  receivable,
  purchases,
  reimbursements,
  accountName,
  accounts,
  movements,
  dueInvoiceIds,
  currency,
  onEdit,
  onPay,
}: {
  person: Person
  receivable: Receivable | undefined
  purchases: CardPurchase[]
  reimbursements: Reimbursement[]
  accountName: (id: string) => string | undefined
  accounts: Account[]
  movements: DetailMovement[]
  dueInvoiceIds: ReadonlySet<string>
  currency: Currency
  onEdit: () => void
  onPay: (suggested: number) => void
}) {
  const categories = useCategories()
  const remove = useDeleteReimbursement()
  const { serverError, run } = useServerAction(() => {})
  const money = (cents: number) => formatMoney(cents, currency)
  const total = receivable?.total ?? 0
  const vencido = receivable?.vencido ?? 0
  const futuro = Math.max(total - vencido, 0)
  const headingId = `pessoa-${person.id}`

  return (
    <section aria-labelledby={headingId} className="rounded-xl border p-4">
      {/* Valores em cima e ações sempre numa linha própria: antes os botões saltavam para o lado ou
          para baixo conforme o tamanho do valor, e os cartões ficavam desiguais */}
      <div className="grid gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate font-medium">
            {person.nome}
          </h2>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight tabular-nums',
              total < 0 && 'text-emerald-700 dark:text-emerald-400',
            )}
          >
            {total > 0
              ? `Deve ${money(total)}`
              : total < 0
                ? `Pagou a mais ${money(-total)}`
                : 'Em dia'}
          </p>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {vencido > 0 ? `Já vencido: ${money(vencido)}` : 'Nada vencido ainda'}
              {futuro > 0 ? ` · em faturas futuras: ${money(futuro)}` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="lg"
            onClick={() => onPay(vencido > 0 ? vencido : Math.max(total, 0))}
            aria-label={`Recebi de ${person.nome}`}
            className="max-sm:flex-1"
          >
            <HandCoins aria-hidden />
            Recebi
          </Button>
          <Button variant="outline" size="lg" onClick={onEdit} aria-label={`Editar ${person.nome}`}>
            <Pencil aria-hidden />
          </Button>
        </div>
      </div>

      {serverError && (
        <div className="mt-3">
          <FormAlert>{serverError}</FormAlert>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
          Ver detalhes: {purchases.length === 1 ? '1 compra' : `${purchases.length} compras`} ·{' '}
          {reimbursements.length === 1
            ? '1 pagamento recebido'
            : `${reimbursements.length} pagamentos recebidos`}
        </summary>
        {person.divida_anterior_centavos > 0 && (
          <p className="mt-2 text-sm">
            Dívida anterior:{' '}
            <span className="tabular-nums">{money(person.divida_anterior_centavos)}</span>
          </p>
        )}
        <PersonDebtDetails
          personId={person.id}
          personName={person.nome}
          purchases={purchases}
          movements={movements}
          dueInvoiceIds={dueInvoiceIds}
          accounts={accounts}
          categories={categories.data ?? []}
          currency={currency}
        />
        {reimbursements.length > 0 && (
          <h3 className="mt-4 mb-1 text-sm font-medium">Pagamentos recebidos</h3>
        )}
        {reimbursements.length > 0 && (
          <ul
            aria-label={`Pagamentos de ${person.nome}`}
            className="divide-y rounded-lg border text-sm"
          >
            {reimbursements.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
                <span className="min-w-0">
                  <span className="block truncate">{item.descricao || 'Pagamento recebido'}</span>
                  <span className="block text-xs text-muted-foreground">
                    {shortDate(item.data)} · {accountName(item.account_id) ?? '—'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
                    {formatMoney(item.valor_centavos, currency, { signDisplay: 'always' })}
                  </span>
                  <ConfirmDeleteButton
                    what={`o pagamento de ${money(item.valor_centavos)} de ${shortDate(item.data)}`}
                    consequence={`O valor volta a contar no que ${person.nome} te deve e sai do saldo da conta.`}
                    disabled={remove.isPending}
                    onConfirm={() => run(() => remove.mutateAsync(item.id))}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}
