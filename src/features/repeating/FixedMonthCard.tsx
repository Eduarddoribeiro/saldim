import { ChevronRight, PiggyBank } from 'lucide-react'
import { Link } from 'react-router'
import { useCategories } from '@/features/categories/hooks'
import { usePeople } from '@/features/people/hooks'
import { colorOf } from '@/features/categories/category-options'
import { useCurrency } from '@/features/profile/hooks'
import { DEFAULT_SHARE, monthlyDeposit } from '@/features/savings/simulate'
import { formatMonth } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { byArea } from './by-area'
import { useFixedMonth } from './use-fixed-month'

const percent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

/** Quantas linhas mostrar em "De onde vem" e "Onde vai" (o resto fica na página Fixos) */
const TOP = 4

/**
 * No Início (pedido de 2026-11-25): quanto entra fixo, quanto sai fixo e o que sobra, de onde vem o
 * dinheiro e para onde vai, quanto sai no mês que vem (cartões + conta) e um atalho para guardar.
 */
export function FixedMonthCard() {
  const fixed = useFixedMonth()
  const categories = useCategories()
  const people = usePeople()
  const currency = useCurrency()
  if (!fixed.data) return null
  const { income, items, rendaFixa, totalMensal, sobra, proximoMes } = fixed.data
  const money = (cents: number) => formatMoney(cents, currency)
  const category = (id: string) => categories.data?.find((row) => row.id === id)

  if (income.length === 0 && items.length === 0) {
    return (
      <Link
        to="/fixos"
        className="mb-4 flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Seu mês fixo</p>
          <p className="text-sm text-muted-foreground">
            Cadastre o que entra e o que sai todo mês (salário, aluguel, assinaturas) para ver
            quanto sobra.
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    )
  }

  const areas = byArea(items).slice(0, TOP)
  const share = rendaFixa > 0 ? totalMensal / rendaFixa : null
  const deposit = monthlyDeposit(sobra, DEFAULT_SHARE)
  const monthName = formatMonth(proximoMes.month).replace(/ de \d{4}$/, '')

  return (
    <section
      aria-labelledby="mes-fixo"
      className="mb-4 grid min-w-0 gap-4 rounded-2xl border bg-card p-4 *:min-w-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="mes-fixo" className="font-semibold">
          Seu mês fixo
        </h2>
        <Link
          to="/fixos"
          className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Ver fixos
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Entra" value={money(rendaFixa)} className="text-positive" />
        <Stat label="Sai" value={money(totalMensal)} />
        <Stat
          label="Sobra"
          value={money(sobra)}
          className={sobra < 0 ? 'text-destructive' : undefined}
        />
      </dl>

      {share !== null && (
        <div className="grid gap-1.5">
          <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-positive/25">
            <span
              className="h-full bg-chart-despesas"
              style={{ width: `${Math.min(1, share) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {share > 1
              ? `Os fixos passam ${percent(share - 1)} do que entra fixo.`
              : `Os fixos levam ${percent(share)} do que entra. Ainda faltam mercado, lanches e o resto do dia a dia.`}
          </p>
        </div>
      )}

      {income.length > 0 && (
        <BarList
          title="De onde vem"
          rows={income.slice(0, TOP).map((item) => ({
            key: item.key,
            nome: item.nome,
            detalhe: category(item.categoryId)?.nome,
            valor: item.mensal,
            share: rendaFixa > 0 ? item.mensal / rendaFixa : 0,
            swatch: colorOf(category(item.categoryId)?.cor ?? 'green').swatch,
          }))}
          money={money}
        />
      )}

      {areas.length > 0 && (
        <BarList
          title="Onde vai"
          rows={areas.map((area) => ({
            key: area.categoryId,
            nome: category(area.categoryId)?.nome ?? 'Sem categoria',
            detalhe: area.nomes.join(', '),
            valor: area.mensal,
            share: area.share,
            swatch: colorOf(category(area.categoryId)?.cor ?? 'slate').swatch,
          }))}
          money={money}
        />
      )}

      {proximoMes.total > 0 && (
        <p className="rounded-xl bg-muted/60 p-3 text-sm">
          <span className="block text-xs text-muted-foreground first-letter:uppercase">
            A pagar em {monthName}
          </span>
          <span className="font-semibold tabular-nums">{money(proximoMes.total)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {' '}
            · sua parte nos cartões {money(proximoMes.cartoes)} + conta {money(proximoMes.conta)}
          </span>
          {proximoMes.pessoas.length > 0 && (
            <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
              As faturas também têm{' '}
              {proximoMes.pessoas
                .map(
                  (person) =>
                    `${money(person.centavos)} de ${people.data?.find((row) => row.id === person.pessoaId)?.nome ?? 'outra pessoa'}`,
                )
                .join(' e ')}{' '}
              (fora deste total).
            </span>
          )}
        </p>
      )}

      {deposit > 0 && (
        <Link
          to="/guardar"
          className="flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PiggyBank className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            Dá para guardar uns <b className="tabular-nums">{money(deposit)}</b> por mês.{' '}
            <span className="text-muted-foreground">Ver quanto rende</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </section>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-semibold tracking-tight tabular-nums', className)}>
        {value}
      </dd>
    </div>
  )
}

function BarList({
  title,
  rows,
  money,
}: {
  title: string
  rows: {
    key: string
    nome: string
    detalhe?: string
    valor: number
    share: number
    swatch: string
  }[]
  money: (cents: number) => string
}) {
  const max = Math.max(...rows.map((row) => row.valor), 1)
  return (
    <div className="grid min-w-0 gap-2 *:min-w-0">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <ul aria-label={title} className="grid gap-2.5 *:min-w-0">
        {rows.map((row) => (
          <li key={row.key} className="grid min-w-0 gap-1 *:min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {row.nome}
                {row.detalhe && row.detalhe !== row.nome && (
                  <span className="text-muted-foreground"> · {row.detalhe}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{money(row.valor)}</span>
                <span className="text-muted-foreground"> · {percent(row.share)}</span>
              </span>
            </div>
            <div aria-hidden className="h-1.5 rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', row.swatch)}
                style={{ width: `${Math.max(2, (row.valor * 100) / max)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
