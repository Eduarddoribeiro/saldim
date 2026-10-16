import { historyFor } from '@/features/accounts/card-days'
import { useCardDaysHistory } from '@/features/accounts/hooks'
import {
  installmentSchedule,
  invoiceDatesWithHistory,
  splitInstallments,
  type CardConfig,
  type CardDaysChange,
} from '@/lib/credit-card'
import { formatMonthShort, type IsoDate, type MonthKey } from '@/lib/dates'
import { formatMoney, type Currency } from '@/lib/money'

export type PreviewInput = {
  /** O cartão: os seus dias antigos (C8) entram no cálculo das faturas */
  accountId: string
  config: CardConfig
  dataCompra: IsoDate
  totalCentavos: number
  numeroParcelas: number
  parcelaInicial: number
}

/** '05/12/2026' */
function shortDate(date: IsoDate): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** 'dez 2026' */
const monthLabel = (month: MonthKey) => `${formatMonthShort(month)} ${month.slice(0, 4)}`

/** Parcelas que a compra vai criar, ou null se os dados ainda não estiverem completos/válidos. */
function previewSchedule(input: PreviewInput, history: CardDaysChange[]) {
  try {
    const { parcelas, restanteCentavos } = installmentSchedule({
      dataCompra: input.dataCompra,
      totalCentavos: input.totalCentavos,
      numeroParcelas: input.numeroParcelas,
      parcelaInicial: input.parcelaInicial,
      config: input.config,
      history,
    })
    return {
      restanteCentavos,
      parcelas: parcelas.map((parcela) => ({
        ...parcela,
        vencimento: invoiceDatesWithHistory(input.config, history, parcela.mesFatura).vencimento,
      })),
    }
  } catch {
    return null
  }
}

/**
 * Pré-visualização: o que vai ser registado, com os mesmos cálculos que a base de dados usa
 * (src/lib/credit-card.ts, comparados com o SQL nos testes). Cada parcela conta como despesa no seu
 * mês (D1a) e é cobrada na fatura indicada.
 */
export function InstallmentPreview({
  input,
  currency,
  title = 'Pré-visualização',
}: {
  input: PreviewInput | null
  currency: Currency
  title?: string
}) {
  // Os dias antigos dos cartões: sem eles, um cartão cujos dias mudaram mostraria faturas erradas
  const history = useCardDaysHistory()
  if (input && history.error) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Não foi possível calcular as faturas. Atualiza a página e tenta de novo.
      </p>
    )
  }
  const schedule =
    input && history.data ? previewSchedule(input, historyFor(history.data, input.accountId)) : null
  if (!input || !schedule) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Indica o valor, as parcelas e a data para ver as faturas.
      </p>
    )
  }

  const { parcelas, restanteCentavos } = schedule
  const n = input.numeroParcelas
  // Valores da compra completa (numa compra em curso, as primeiras parcelas não aparecem na lista)
  const valores = splitInstallments(input.totalCentavos, n)
  const [base, ultima] = [valores[0], valores[n - 1]]
  const money = (cents: number) => formatMoney(cents, currency)
  const resumo =
    n === 1
      ? `À vista: ${money(base)}`
      : base === ultima
        ? `${n}× ${money(base)}`
        : `${n}× ${money(base)} (a última ${money(ultima)})`

  return (
    <section aria-labelledby="previsao-titulo" className="grid gap-2 rounded-lg border p-3">
      <h3 id="previsao-titulo" className="text-sm font-medium">
        {title}
      </h3>
      <p role="status" className="text-sm">
        {resumo}
        {input.parcelaInicial > 1 && (
          <>
            {' · '}
            {parcelas.length === 1 ? `só a ${n}.ª` : `da ${input.parcelaInicial}.ª à ${n}.ª`}:{' '}
            {money(restanteCentavos)}
          </>
        )}
      </p>
      <ol aria-label="Parcelas" className="max-h-48 divide-y overflow-y-auto text-sm">
        {parcelas.map((parcela) => (
          <li key={parcela.numero} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="font-medium tabular-nums">
                {parcela.numero}/{n}
              </span>{' '}
              <span className="text-muted-foreground">
                fatura de {monthLabel(parcela.mesFatura)} · vence {shortDate(parcela.vencimento)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{money(parcela.valorCentavos)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
