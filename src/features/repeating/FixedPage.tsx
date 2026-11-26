import { Plus, Repeat } from 'lucide-react'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'
import { Button } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts/hooks'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { useCategories } from '@/features/categories/hooks'
import { HeroStat } from '@/features/dashboard/BalanceHero'
import { useCurrency } from '@/features/profile/hooks'
import { useRecurring, useUpdateRecurring } from '@/features/recurring/hooks'
import type { Recurring } from '@/features/recurring/recurring-api'
import { failureMessage } from '@/features/recurring/recurring-options'
import { RecurringFormDialog } from '@/features/recurring/RecurringFormDialog'
import { RecurringRow } from '@/features/recurring/RecurringRow'
import { errorMessage } from '@/lib/db-errors'
import { centsToInput, formatMoney } from '@/lib/money'
import { AreaBreakdown } from './AreaBreakdown'
import { byArea } from './by-area'
import { useRepeatingExpenses } from './hooks'
import { MIN_MONTHS, WINDOW_MONTHS, type RepeatingExpense } from './repeating'

const percent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

type DialogState = {
  open: boolean
  recurring: Recurring | null
  preset?: ComponentProps<typeof RecurringFormDialog>['preset']
}

/**
 * Fixos (/fixos, pedido de 2026-11-25): numa página só, o que entra e o que sai todo mês. Junta os
 * recorrentes cadastrados (criar, editar, pausar) e o que a app descobriu nos lançamentos (com um
 * botão para cadastrar), o total por mês, o que sobra e para onde vai, por área.
 */
export function FixedPage() {
  const recurring = useRecurring()
  const repeating = useRepeatingExpenses()
  const accounts = useAccounts()
  const categories = useCategories()
  const currency = useCurrency()
  const dismiss = useUpdateRecurring()
  const [dialog, setDialog] = useState<DialogState>({ open: false, recurring: null })
  const money = (cents: number) => formatMoney(cents, currency)
  const category = (id: string) => categories.data?.find((item) => item.id === id)
  const accountName = (id: string) => accounts.data?.find((account) => account.id === id)?.nome

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader title="Fixos" description="O que entra e o que sai todo mês." />
      <Button
        size="lg"
        onClick={() => setDialog({ open: true, recurring: null })}
        className="max-sm:mb-3 max-sm:w-full"
      >
        <Plus aria-hidden />
        Novo fixo
      </Button>
    </div>
  )
  const dialogElement = (
    <RecurringFormDialog
      open={dialog.open}
      onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      recurring={dialog.recurring}
      preset={dialog.preset}
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
    />
  )

  if (recurring.isPending || accounts.isPending || categories.isPending) {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground" role="status">
          Carregando fixos…
        </p>
      </>
    )
  }
  const error = recurring.error ?? accounts.error ?? categories.error
  if (error) {
    return (
      <>
        {header}
        <div className="grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button variant="outline" className="w-fit" onClick={() => recurring.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    )
  }

  const all = recurring.data ?? []
  const failures = all.filter((item) => item.falha && item.falha_data)
  // Ativos por próxima data; os pausados no fim
  const sorted = [...all.filter((item) => item.ativa), ...all.filter((item) => !item.ativa)]
  const saidas = sorted.filter((item) => item.tipo === 'despesa')
  const entradas = sorted.filter((item) => item.tipo === 'receita')
  // Os descobertos (só se o histórico já carregou; se falhar, a página funciona sem eles)
  const detected = repeating.data
  const discoveredOut = detected?.items.filter((item) => !item.registada) ?? []
  const discoveredIn = detected?.income.filter((item) => !item.registada) ?? []
  const register = (item: RepeatingExpense, tipo: 'despesa' | 'receita') =>
    setDialog({
      open: true,
      recurring: null,
      preset: {
        tipo,
        descricao: item.nome,
        valor: centsToInput(item.mensal),
        categoryId: item.categoryId,
        // Valor que varia (mercado, corte de cabelo): só lembrar, com o valor médio
        modo: item.fixo ? 'automatico' : 'lembrar',
      },
    })
  const edit = (item: Recurring) => setDialog({ open: true, recurring: item })
  const row = (item: Recurring) => (
    <li key={item.id}>
      <RecurringRow
        item={item}
        category={category(item.category_id)}
        accountName={accountName(item.account_id)}
        currency={currency}
        onEdit={() => edit(item)}
      />
    </li>
  )

  if (sorted.length === 0 && discoveredOut.length === 0 && discoveredIn.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Repeat}
          title="Nenhum fixo ainda"
          description="Cadastre o salário, o aluguel ou a Netflix: o lançamento aparece sozinho todo mês. O que voltar nos seus lançamentos também aparece aqui."
        />
        {dialogElement}
      </>
    )
  }

  const entra = detected?.rendaFixa ?? 0
  const sai = detected?.totalMensal ?? 0
  const share = entra > 0 ? sai / entra : null

  return (
    <>
      {header}

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

      <div className="grid min-w-0 gap-6 *:min-w-0">
        {detected && (
          <section
            aria-label="Resumo dos fixos"
            className="rounded-3xl bg-linear-to-b from-hero to-hero-2 px-5 pt-4 pb-5 text-hero-foreground"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-hero-foreground/80">Sobra por mês</p>
                <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums">
                  {money(entra - sai)}
                </p>
              </div>
              <PrivacyToggle className="-mt-1 -mr-2" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
              <HeroStat label="Entra" value={money(entra)} />
              <HeroStat
                label="Sai"
                value={money(sai)}
                hint={
                  share === null
                    ? `Por ano: ${money(sai * 12)}`
                    : `${percent(share)} do que entra · por ano: ${money(sai * 12)}`
                }
              />
            </div>
          </section>
        )}

        <FixedSection title="Sai todo mês" count={saidas.length}>
          {saidas.length > 0 ? (
            <ul aria-label="Sai todo mês" className="divide-y rounded-2xl border bg-card">
              {saidas.map(row)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma saída cadastrada.</p>
          )}
          <Discovered
            items={discoveredOut}
            tipo="despesa"
            money={money}
            category={category}
            onRegister={register}
          />
        </FixedSection>

        {detected && (
          <AreaBreakdown rows={byArea(detected.items)} category={category} money={money} />
        )}

        <FixedSection title="Entra todo mês" count={entradas.length}>
          {entradas.length > 0 ? (
            <ul aria-label="Entra todo mês" className="divide-y rounded-2xl border bg-card">
              {entradas.map(row)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrada cadastrada. Cadastre o salário ou a ajuda que você recebe todo mês
              para ver quanto sobra.
            </p>
          )}
          <Discovered
            items={discoveredIn}
            tipo="receita"
            money={money}
            category={category}
            onRegister={register}
          />
        </FixedSection>

        <p className="text-xs text-muted-foreground">
          "Descoberto" é o que voltou em pelo menos {MIN_MONTHS} dos últimos {WINDOW_MONTHS} meses
          nos seus lançamentos. Parcelas e compras de outras pessoas não contam.
        </p>
      </div>

      {dialogElement}
    </>
  )
}

function FixedSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  const id = `fixos-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-2 *:min-w-0">
      <h2 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title} {count > 0 && <span className="font-normal">({count})</span>}
      </h2>
      {children}
    </section>
  )
}

/** O que voltou nos lançamentos e ainda não está cadastrado, com o botão para cadastrar. */
function Discovered({
  items,
  tipo,
  money,
  category,
  onRegister,
}: {
  items: RepeatingExpense[]
  tipo: 'despesa' | 'receita'
  money: (cents: number) => string
  category: (id: string) => { nome: string; cor: string; icone: string } | undefined
  onRegister: (item: RepeatingExpense, tipo: 'despesa' | 'receita') => void
}) {
  if (items.length === 0) return null
  const label = tipo === 'despesa' ? 'Saídas descobertas' : 'Entradas descobertas'
  return (
    <div className="mt-2 grid gap-2">
      <h3 className="text-sm font-medium">
        Descobertos pela app{' '}
        <span className="font-normal text-muted-foreground">
          · voltam todo mês, toque para cadastrar
        </span>
      </h3>
      <ul aria-label={label} className="divide-y rounded-2xl border border-dashed bg-card">
        {items.map((item) => {
          const cat = category(item.categoryId)
          const detail = [
            item.vezesPorMes >= 1.5 ? `~${Math.round(item.vezesPorMes)}× por mês` : 'Todo mês',
            cat?.nome,
            item.fixo ? null : 'valor varia (média)',
          ]
            .filter(Boolean)
            .join(' · ')
          const amount = money(item.mensal)
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onRegister(item, tipo)}
                aria-label={`${item.nome}: ${amount} por mês, ${detail}. Cadastrar`}
                className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
              >
                <CategoryBadge cor={cat?.cor ?? 'slate'} icone={cat?.icone ?? 'tag'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.nome}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium tabular-nums">{amount}</span>
                  <span className="block text-xs text-muted-foreground">por mês</span>
                </span>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus className="size-4" aria-hidden />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
