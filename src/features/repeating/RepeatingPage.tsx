import { Repeat } from 'lucide-react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { useCategories } from '@/features/categories/hooks'
import { HeroStat } from '@/features/dashboard/BalanceHero'
import { useCurrency } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { AreaBreakdown } from './AreaBreakdown'
import { byArea } from './by-area'
import { useRepeatingExpenses } from './hooks'
import { MIN_MONTHS, WINDOW_MONTHS, type RepeatingExpense } from './repeating'

const percent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

/**
 * Gastos que se repetem (/gastos-fixos): o que volta todos os meses, quanto custa por mês e por ano
 * e que parte do que entra vai para lá. Separados em valor fixo (contas, assinaturas) e valor que
 * varia (mercado, transporte…).
 */
export function RepeatingPage() {
  const repeating = useRepeatingExpenses()
  const categories = useCategories()
  const currency = useCurrency()
  const money = (cents: number) => formatMoney(cents, currency)
  const category = (id: string) => categories.data?.find((item) => item.id === id)

  const header = (
    <PageHeader
      title="Gastos que se repetem"
      description={`O que volta todos os meses, pelos últimos ${WINDOW_MONTHS} meses.`}
    />
  )
  if (repeating.isPending) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Carregando…
        </p>
      </>
    )
  }
  if (repeating.error || !repeating.data) {
    return (
      <>
        {header}
        <div className="grid gap-3">
          <FormAlert>{errorMessage(repeating.error)}</FormAlert>
          <Button variant="outline" className="w-fit" onClick={repeating.refetch}>
            Tentar de novo
          </Button>
        </div>
      </>
    )
  }

  const { items, totalMensal, totalAnual, percentual } = repeating.data
  const fixos = items.filter((item) => item.fixo)
  const variaveis = items.filter((item) => !item.fixo)
  const cadastrados = items.filter((item) => item.registada).length
  const descobertos = items.length - cadastrados

  return (
    <>
      {header}
      {items.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Ainda não há gastos que se repetem"
          description={`Um gasto aparece aqui quando volta em pelo menos ${MIN_MONTHS} dos últimos ${WINDOW_MONTHS} meses, ou quando está em Recorrentes.`}
        />
      ) : (
        <div className="grid min-w-0 gap-5 *:min-w-0">
          <section
            aria-label="Total dos gastos que se repetem"
            className="rounded-3xl bg-linear-to-b from-hero to-hero-2 px-5 pt-4 pb-5 text-hero-foreground"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-hero-foreground/80">Por mês</p>
                <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums">
                  {money(totalMensal)}
                </p>
              </div>
              <PrivacyToggle className="-mt-1 -mr-2" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
              <HeroStat label="Por ano" value={money(totalAnual)} />
              <HeroStat
                label="Do que entra"
                value={percentual === null ? '—' : percent(percentual)}
                hint={percentual === null ? 'Sem receitas nos últimos 3 meses' : undefined}
              />
            </div>
          </section>

          <p className="-mt-2 text-sm text-muted-foreground">
            {cadastrados === 1 ? '1 cadastrado' : `${cadastrados} cadastrados`} em Recorrentes ·{' '}
            {descobertos === 1 ? '1 descoberto' : `${descobertos} descobertos`} pela app nos seus
            lançamentos
          </p>

          <AreaBreakdown rows={byArea(items)} category={category} money={money} />

          {fixos.length > 0 && (
            <ExpenseList
              title="Valor fixo"
              hint="Contas e assinaturas"
              items={fixos}
              money={money}
              category={category}
            />
          )}
          {variaveis.length > 0 && (
            <ExpenseList
              title="Valor que varia"
              hint="Do dia a dia (média por mês)"
              items={variaveis}
              money={money}
              category={category}
            />
          )}

          <p className="text-sm text-muted-foreground">
            Um gasto fixo que o Saldim deve lançar sozinho todo mês?{' '}
            <Link
              to="/configuracoes/recorrentes"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Cadastre-o em Recorrentes
            </Link>
            .
          </p>
        </div>
      )}
    </>
  )
}

function ExpenseList({
  title,
  hint,
  items,
  money,
  category,
}: {
  title: string
  hint: string
  items: RepeatingExpense[]
  money: (cents: number) => string
  category: (id: string) => { nome: string; cor: string; icone: string } | undefined
}) {
  const id = `gastos-${title.toLowerCase().replace(/\s+/g, '-')}`
  const subtotal = items.reduce((sum, item) => sum + item.mensal, 0)
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-2 *:min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={id}
          className="min-w-0 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {title} <span className="font-normal normal-case">· {hint}</span>
        </h2>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
          {money(subtotal)}/mês
        </span>
      </div>
      <ul className="divide-y rounded-2xl border bg-card">
        {items.map((item) => {
          const cat = category(item.categoryId)
          const detail = [
            item.vezesPorMes >= 1.5 ? `~${Math.round(item.vezesPorMes)}× por mês` : 'Todo mês',
            cat?.nome,
            item.registada ? 'Cadastrado em Recorrentes' : 'Descoberto pela app',
            item.esteMes > 0 ? `este mês: ${money(item.esteMes)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={item.key} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
              <CategoryBadge cor={cat?.cor ?? 'slate'} icone={cat?.icone ?? 'tag'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.nome}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-medium tabular-nums">{money(item.mensal)}</span>
                <span className="block text-xs text-muted-foreground">por mês</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
