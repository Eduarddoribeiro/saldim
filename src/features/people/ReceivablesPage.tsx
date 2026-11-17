import { ChevronDown, HandCoins, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDeleteButton } from '@/components/form/ConfirmDeleteButton'
import { FormAlert } from '@/components/form/FormAlert'
import { useServerAction } from '@/components/form/use-server-action'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import { useCategories } from '@/features/categories/hooks'
import { HeroStat } from '@/features/dashboard/BalanceHero'
import { useCurrency } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import type { Receivable } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useDeleteReimbursement, usePeople } from './hooks'
import type { Person, Reimbursement } from './people-api'
import { PersonDebtDetails } from './PersonDebtDetails'
import { PersonFormDialog } from './PersonFormDialog'
import { ReimbursementFormDialog } from './ReimbursementFormDialog'
import { UpcomingInvoices, type PersonMovement } from './UpcomingInvoices'
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
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="A receber"
          description="Compras de outras pessoas no seu cartão e o que já te devolveram."
        />
        <Button
          variant="outline"
          size="lg"
          onClick={() => setPersonDialog({ open: true, person: null })}
          className="shrink-0 rounded-full"
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
        <div className="grid min-w-0 gap-4 *:min-w-0">
          <ReceivablesSummary
            rows={visible.map((person) => byPerson.get(person.id))}
            currency={currency}
          />
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
              invoices={receivables.invoices}
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
          <ul className="mt-2 divide-y rounded-2xl border bg-card opacity-70">
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
  invoices,
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
  movements: PersonMovement[]
  dueInvoiceIds: ReadonlySet<string>
  invoices: { id: string; data_vencimento: string }[]
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
    <section aria-labelledby={headingId} className="rounded-2xl border bg-card">
      <div className="grid gap-4 p-4 pb-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
          >
            {person.nome.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="truncate font-medium">
              {person.nome}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {purchases.length === 1 ? '1 compra' : `${purchases.length} compras`} no seu cartão
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            className="-mr-2 shrink-0 rounded-full"
            onClick={onEdit}
            aria-label={`Editar ${person.nome}`}
          >
            <Pencil aria-hidden />
          </Button>
        </div>

        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-3xl font-semibold tracking-tight tabular-nums',
              total < 0 && 'text-positive',
            )}
          >
            {total > 0
              ? `Deve ${money(total)}`
              : total < 0
                ? `Pagou a mais ${money(-total)}`
                : 'Em dia'}
          </p>
          {total > 0 && (
            // O que já venceu e o que vem: em "pílulas", o vencido em destaque
            <p className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1',
                  vencido > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {vencido > 0 ? (
                  <>
                    Já vencido: <span className="tabular-nums">{money(vencido)}</span>
                  </>
                ) : (
                  'Nada vencido ainda'
                )}
              </span>
              {futuro > 0 && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  Em faturas futuras: <span className="tabular-nums">{money(futuro)}</span>
                </span>
              )}
            </p>
          )}
        </div>

        <Button
          size="lg"
          onClick={() => onPay(vencido > 0 ? vencido : Math.max(total, 0))}
          aria-label={`Recebi de ${person.nome}`}
          className="h-12 w-full rounded-full text-base"
        >
          <HandCoins aria-hidden />
          Recebi
        </Button>
      </div>

      <div className="px-4">
        <UpcomingInvoices
          personId={person.id}
          vencido={vencido}
          futuro={futuro}
          movements={movements}
          purchases={purchases}
          invoices={invoices}
          accounts={accounts}
          categories={categories.data ?? []}
          currency={currency}
        />

        {serverError && (
          <div className="mt-3">
            <FormAlert>{serverError}</FormAlert>
          </div>
        )}
      </div>

      <details className="group mt-4 border-t">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-muted-foreground select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 truncate">
            Ver detalhes: {purchases.length === 1 ? '1 compra' : `${purchases.length} compras`} ·{' '}
            {reimbursements.length === 1
              ? '1 pagamento recebido'
              : `${reimbursements.length} pagamentos recebidos`}
          </span>
          <ChevronDown
            className="size-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="px-4 pb-4">
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
              className="divide-y rounded-xl border text-sm"
            >
              {reimbursements.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-1 pr-1 pl-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.descricao || 'Pagamento recebido'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shortDate(item.data)} · {accountName(item.account_id) ?? '—'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-positive tabular-nums">
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
        </div>
      </details>
    </section>
  )
}

/**
 * Faixa do topo (como o saldo no Início): quanto te devem no total, com o que já venceu e o que
 * vem nas próximas faturas. Só os valores positivos: quem pagou a mais não desconta dos outros.
 */
function ReceivablesSummary({
  rows,
  currency,
}: {
  rows: (Receivable | undefined)[]
  currency: Currency
}) {
  let total = 0
  let vencido = 0
  for (const row of rows) {
    if (!row || row.total <= 0) continue
    total += row.total
    vencido += Math.min(row.vencido, row.total)
  }
  const money = (cents: number) => formatMoney(cents, currency)
  return (
    <section
      aria-label="Total a receber"
      className="rounded-3xl bg-linear-to-b from-hero to-hero-2 px-5 pt-4 pb-5 text-hero-foreground"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-hero-foreground/80">Te devem no total</p>
          <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums">
            {money(total)}
          </p>
        </div>
        <PrivacyToggle className="-mt-1 -mr-2" />
      </div>
      {total > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
          <HeroStat label="Já vencido" value={money(vencido)} />
          <HeroStat label="Em faturas futuras" value={money(total - vencido)} />
        </div>
      )}
    </section>
  )
}
