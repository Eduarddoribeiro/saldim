// Gráficos do Início com Recharts. Este ficheiro só é carregado quando o Início os mostra
// (React.lazy em DashboardCharts.tsx): o Recharts fica num ficheiro JS à parte, fora do arranque.
// Aqui não há cálculos: os valores chegam já calculados por src/lib/finance.ts, em centavos.
// Acessibilidade: o gráfico é uma imagem com descrição (role="img" em DashboardCharts.tsx) e a
// alternativa completa é a tabela ao lado; por isso a camada de teclado do Recharts fica desligada.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatMoneyCompact, type Currency } from '@/lib/money'

export type MonthlyBarsDatum = { label: string; title: string; receitas: number; despesas: number }
export type BalanceDatum = {
  label: string
  title: string
  /** Saldo realizado (null nos meses futuros) */
  saldo: number | null
  /** Saldo previsto (null nos meses passados; repete o último ponto realizado para ligar as linhas) */
  previsto: number | null
}

/** O que as dicas usam das props do Recharts: se estão ativas e o ponto (com o dado original). */
type TooltipState = { active?: boolean; payload?: readonly { payload?: unknown }[] }

const HEIGHT = 220
const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 }
const yAxisProps = (currency: Currency) => ({
  tick: axisTick,
  tickLine: false,
  axisLine: false,
  width: 72,
  tickFormatter: (value: number) => formatMoneyCompact(Math.round(value), currency),
})

function TooltipCard({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: string; swatch: string; dashed?: boolean }[]
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-3"
            style={{
              borderTop: `2px ${row.dashed ? 'dashed' : 'solid'} ${row.swatch}`,
            }}
            aria-hidden
          />
          <span className="text-muted-foreground">{row.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">{row.value}</span>
        </p>
      ))}
    </div>
  )
}

/** Barras agrupadas: receitas e despesas por mês, numa só escala (sem segundo eixo). */
export function MonthlyBarsChart({
  data,
  currency,
}: {
  data: MonthlyBarsDatum[]
  currency: Currency
}) {
  const renderTooltip = ({ active, payload }: TooltipState) => {
    const datum = payload?.[0]?.payload as MonthlyBarsDatum | undefined
    if (!active || !datum) return null
    return (
      <TooltipCard
        title={datum.title}
        rows={[
          {
            label: 'Receitas',
            value: formatMoney(datum.receitas, currency),
            swatch: 'var(--chart-receitas)',
          },
          {
            label: 'Despesas',
            value: formatMoney(datum.despesas, currency),
            swatch: 'var(--chart-despesas)',
          },
        ]}
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart
        data={data}
        barGap={2}
        accessibilityLayer={false}
        margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis {...yAxisProps(currency)} />
        <Tooltip content={renderTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
        <Bar
          dataKey="receitas"
          name="Receitas"
          fill="var(--chart-receitas)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
        <Bar
          dataKey="despesas"
          name="Despesas"
          fill="var(--chart-despesas)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Linha do saldo no fim de cada mês; meses futuros a tracejado (previsão). */
export function BalanceLineChart({ data, currency }: { data: BalanceDatum[]; currency: Currency }) {
  const values = data.flatMap((datum) => [datum.saldo, datum.previsto]).filter((v) => v !== null)
  const hasNegative = values.some((value) => value < 0)

  const renderTooltip = ({ active, payload }: TooltipState) => {
    const datum = payload?.[0]?.payload as BalanceDatum | undefined
    if (!active || !datum) return null
    const isForecast = datum.saldo === null
    const value = datum.saldo ?? datum.previsto ?? 0
    return (
      <TooltipCard
        title={datum.title}
        rows={[
          {
            label: isForecast ? 'Saldo previsto' : 'Saldo',
            value: formatMoney(value, currency),
            swatch: 'var(--foreground)',
            dashed: isForecast,
          },
        ]}
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart
        data={data}
        accessibilityLayer={false}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis {...yAxisProps(currency)} />
        {hasNegative && <ReferenceLine y={0} stroke="var(--muted-foreground)" />}
        <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--border)' }} />
        {/* A previsão primeiro: no mês de ligação, o ponto realizado (cheio) fica por cima */}
        <Line
          dataKey="previsto"
          name="Saldo previsto"
          stroke="var(--foreground)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 4, fill: 'var(--card)', stroke: 'var(--foreground)', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="saldo"
          name="Saldo"
          className="saldo-realizado"
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--foreground)', stroke: 'var(--card)', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
