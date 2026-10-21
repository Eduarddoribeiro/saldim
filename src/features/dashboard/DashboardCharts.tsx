import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Link } from 'react-router'
import { formatMonth, formatMonthShort, lastDayOfMonth, type MonthKey } from '@/lib/dates'
import type { BalancePoint, MonthlyTotals } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import type { BalanceDatum, MonthlyBarsDatum } from './charts'
import { Panel } from './Panel'

// O Recharts só é descarregado quando um destes gráficos aparece (ficheiro JS à parte).
// Uma só importação partilhada pelos dois gráficos.
let chartsModule: Promise<typeof import('./charts')> | undefined
const loadCharts = () => (chartsModule ??= import('./charts'))
const MonthlyBarsChart = lazy(() =>
  loadCharts().then((module) => ({ default: module.MonthlyBarsChart })),
)
const BalanceLineChart = lazy(() =>
  loadCharts().then((module) => ({ default: module.BalanceLineChart })),
)

/** Se o ficheiro do gráfico não carregar (ex.: rede), a tabela continua lá com os valores. */
class ChartErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <p role="alert" className="rounded-lg bg-muted px-3 py-6 text-center text-sm">
          Não foi possível mostrar o gráfico. Os valores estão na tabela abaixo.
        </p>
      )
    }
    return this.props.children
  }
}

/** Gráfico como imagem com descrição; enquanto o Recharts carrega, um bloco com a mesma altura. */
function ChartFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ChartErrorBoundary>
      <Suspense
        fallback={
          <div role="status" className="h-[220px] animate-pulse rounded-lg bg-muted/60">
            <span className="sr-only">Carregando o gráfico…</span>
          </div>
        }
      >
        <div role="img" aria-label={label} className="h-[220px] min-w-0">
          {children}
        </div>
      </Suspense>
    </ChartErrorBoundary>
  )
}

/** Amostra da legenda com a mesma forma da marca: bloco (barras), linha ou tracejado (previsão). */
function LegendItem({
  label,
  swatch,
  mark,
}: {
  label: string
  swatch: string
  mark: 'bar' | 'line' | 'dashed'
}) {
  const border =
    mark === 'bar'
      ? `8px solid ${swatch}`
      : `2px ${mark === 'dashed' ? 'dashed' : 'solid'} ${swatch}`
  return (
    <li className="flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: border }} aria-hidden />
      {label}
    </li>
  )
}

function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string
  head: string[]
  rows: { key: string; cells: string[] }[]
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
        Ver valores em tabela
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              {head.map((cell, index) => (
                <th key={cell} scope="col" className={index > 0 ? 'py-1 text-right' : 'py-1'}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row" className="py-1.5 font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="py-1.5 pl-3 text-right">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

const rangeLabel = (months: MonthKey[]) =>
  `${formatMonth(months[0])} a ${formatMonth(months.at(-1)!)}`
const spansYears = (months: MonthKey[]) => months[0].slice(0, 4) !== months.at(-1)!.slice(0, 4)

/** Receitas × despesas dos meses da série (barras agrupadas + tabela). */
export function MonthlyComparisonPanel({
  series,
  currency,
}: {
  series: MonthlyTotals[]
  currency: Currency
}) {
  const months = series.map((row) => row.month)
  const range = rangeLabel(months)
  const isEmpty = series.every((row) => row.receitas === 0 && row.despesas === 0)
  const withYear = spansYears(months)
  const data: MonthlyBarsDatum[] = series.map((row) => ({
    label: formatMonthShort(row.month, withYear),
    title: formatMonth(row.month),
    receitas: row.receitas,
    despesas: row.despesas,
  }))

  return (
    <Panel title="Receitas e despesas">
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">Nenhuma receita ou despesa de {range}.</p>
      ) : (
        <>
          <ul className="mb-2 flex gap-4 text-xs text-muted-foreground">
            <LegendItem label="Receitas" swatch="var(--chart-receitas)" mark="bar" />
            <LegendItem label="Despesas" swatch="var(--chart-despesas)" mark="bar" />
          </ul>
          <ChartFrame
            label={`Gráfico de barras com as receitas e as despesas de ${range}. Os valores estão na tabela.`}
          >
            <MonthlyBarsChart data={data} currency={currency} />
          </ChartFrame>
          <DataTable
            caption={`Receitas e despesas de ${range}`}
            head={['Mês', 'Receitas', 'Despesas', 'Resultado']}
            rows={series.map((row) => ({
              key: row.month,
              cells: [
                formatMonth(row.month),
                formatMoney(row.receitas, currency),
                formatMoney(row.despesas, currency),
                formatMoney(row.resultado, currency, { signDisplay: 'exceptZero' }),
              ],
            }))}
          />
        </>
      )}
    </Panel>
  )
}

/** Saldo no fim de cada mês (linha + tabela). Meses futuros: previsão, a tracejado. */
export function BalanceEvolutionPanel({
  points,
  currency,
  hasAccounts,
}: {
  points: BalancePoint[]
  currency: Currency
  hasAccounts: boolean
}) {
  const months = points.map((point) => point.month)
  const range = rangeLabel(months)
  const withYear = spansYears(months)
  const hasForecast = points.some((point) => point.previsto)
  const lastActual = points.findLastIndex((point) => !point.previsto)
  const data: BalanceDatum[] = points.map((point, index) => ({
    label: formatMonthShort(point.month, withYear),
    title: balanceRowLabel(point),
    saldo: point.previsto ? null : point.saldo,
    // O último ponto realizado também abre a linha prevista, para as duas se ligarem
    previsto: point.previsto || (hasForecast && index === lastActual) ? point.saldo : null,
  }))

  return (
    <Panel title="Evolução do saldo">
      {!hasAccounts ? (
        <p className="text-sm text-muted-foreground">
          Crie uma conta para ver a evolução do saldo.{' '}
          <Link
            to="/configuracoes/contas"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Criar conta
          </Link>
        </p>
      ) : (
        <>
          <ul className="mb-2 flex gap-4 text-xs text-muted-foreground">
            <LegendItem label="Saldo no fim do mês" swatch="var(--foreground)" mark="line" />
            {hasForecast && (
              <LegendItem label="Previsto" swatch="var(--foreground)" mark="dashed" />
            )}
          </ul>
          <ChartFrame
            label={`Gráfico de linha com o saldo total no fim de cada mês, de ${range}. Os valores estão na tabela.`}
          >
            <BalanceLineChart data={data} currency={currency} />
          </ChartFrame>
          <DataTable
            caption={`Saldo total no fim de cada mês, de ${range}`}
            head={['Mês', 'Saldo']}
            rows={points.map((point) => ({
              key: point.month,
              cells: [balanceRowLabel(point), formatMoney(point.saldo, currency)],
            }))}
          />
        </>
      )}
    </Panel>
  )
}

/** 'outubro de 2026 (até hoje)' no mês atual, '(previsto)' nos futuros. */
function balanceRowLabel(point: BalancePoint): string {
  if (point.previsto) return `${formatMonth(point.month)} (previsto)`
  // No mês atual o corte é hoje, não o último dia do mês
  const isPartial = point.ate !== lastDayOfMonth(point.month)
  return isPartial ? `${formatMonth(point.month)} (até hoje)` : formatMonth(point.month)
}
