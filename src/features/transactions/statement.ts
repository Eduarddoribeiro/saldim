import { addDays, formatDay, type IsoDate } from '@/lib/dates'

type Movement = { tipo: string; valor_centavos: number }

/**
 * Totais de um extrato: o que entrou (receitas e estornos) e o que saiu (despesas, incluindo as
 * parcelas no cartão e as compras de outras pessoas), tal como aparecem na lista. Não é o resumo do
 * mês do Início (`monthSummary`), que deixa de fora as compras de outras pessoas.
 */
export function statementTotals(items: readonly Movement[]) {
  let entrou = 0
  let saiu = 0
  for (const item of items) {
    if (item.tipo === 'despesa') saiu += item.valor_centavos
    else entrou += item.valor_centavos
  }
  return { entrou, saiu, saldo: entrou - saiu }
}

/** "Hoje, 17 de novembro", "Ontem, 16 de novembro" ou "Sábado, 14 de novembro" (como nos bancos). */
export function statementDayLabel(day: IsoDate, today: IsoDate): string {
  const prefix = day === today ? 'Hoje' : day === addDays(today, -1) ? 'Ontem' : null
  const full = formatDay(day, Number(today.slice(0, 4)))
  if (!prefix) return full.charAt(0).toUpperCase() + full.slice(1)
  // Sem o dia da semana: "Hoje, 17 de novembro"
  return `${prefix}, ${full.slice(full.indexOf(',') + 2)}`
}

/**
 * Separa o extrato em "previsto" (datas depois de hoje: parcelas que ainda vão cair, lançamentos
 * agendados) e o que já aconteceu. O previsto vem do mais próximo para o mais distante; o resto mantém
 * a ordem recebida (mais recente primeiro).
 */
export function splitByToday<T extends { data: IsoDate }>(items: readonly T[], today: IsoDate) {
  const previsto = items.filter((item) => item.data > today)
  const realizado = items.filter((item) => item.data <= today)
  previsto.sort((a, b) => a.data.localeCompare(b.data))
  return { previsto, realizado }
}
