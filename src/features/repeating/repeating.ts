import { descriptionKey } from '@/features/import/suggest'
import { addMonths, type IsoDate, type MonthKey } from '@/lib/dates'

// Gastos que se repetem (pedido de 2026-11-23: "saber onde vai meu dinheiro"). Descobre, pelos
// últimos 6 meses completos, o que volta todos os meses (assinaturas, contas, mercado…), mesmo sem
// estar em Recorrentes, e junta as recorrências de despesa ativas. Função pura.

/** Meses completos olhados (o mês atual ainda não acabou) */
export const WINDOW_MONTHS = 6
/** Em quantos desses meses tem de aparecer para contar como "repete-se" */
export const MIN_MONTHS = 3
/** E em quantos dos 3 últimos (para não contar o que já acabou) */
export const MIN_RECENT = 2

type Movement = {
  descricao: string
  category_id: string
  tipo: string
  valor_centavos: number
  data: IsoDate
  pessoa_id: string | null
  compra_id: string | null
  recorrencia_id: string | null
}
type Recurrence = {
  id: string
  descricao: string
  category_id: string
  tipo: string
  valor_centavos: number
  frequencia: string
  ativa: boolean
}

export type RepeatingExpense = {
  key: string
  nome: string
  categoryId: string
  /** Quanto custa por mês (mediana dos meses em que apareceu; recorrência anual ÷ 12) */
  mensal: number
  /** Quantas vezes por mês, em média (1 = uma vez por mês) */
  vezesPorMes: number
  /** O valor quase não muda de mês para mês (até 10%) */
  fixo: boolean
  /** Em quantos dos últimos 6 meses apareceu */
  meses: number
  /** Está em Recorrentes */
  registada: boolean
  /** Quanto já saiu este mês */
  esteMes: number
  ultimaData: IsoDate | null
}

type Input = {
  movements: readonly Movement[]
  purchases: readonly { id: string; parcelas: number }[]
  recurrences: readonly Recurrence[]
  today: IsoDate
}

export function repeatingExpenses(input: Input) {
  const { movements, today } = input
  const items = repeatingItems(input, 'despesa')
  // O que entra todo mês, com as mesmas regras: receitas recorrentes cadastradas ou descobertas
  const income = repeatingItems(input, 'receita')
  const recent = new Set(Array.from({ length: 3 }, (_, i) => addMonths(today.slice(0, 7), i - 3)))

  // O que entra por mês: média das receitas dos 3 últimos meses completos
  const receitas = movements
    .filter((m) => m.tipo === 'receita' && recent.has(m.data.slice(0, 7)))
    .reduce((sum, m) => sum + m.valor_centavos, 0)
  const receitaMensal = Math.round(receitas / 3)
  const totalMensal = items.reduce((sum, item) => sum + item.mensal, 0)
  const rendaFixa = income.reduce((sum, item) => sum + item.mensal, 0)
  return {
    items,
    totalMensal,
    totalAnual: totalMensal * 12,
    receitaMensal,
    /** Parte do que entra que vai para gastos que se repetem (null sem receitas) */
    percentual: receitaMensal > 0 ? totalMensal / receitaMensal : null,
    income,
    /** O que entra fixo por mês (receitas que se repetem) */
    rendaFixa,
  }
}

/** O que se repete de um tipo (despesa ou receita): descoberto no histórico ou cadastrado. */
function repeatingItems(
  { movements, purchases, recurrences, today }: Input,
  tipo: 'despesa' | 'receita',
): RepeatingExpense[] {
  const current = today.slice(0, 7)
  const window = Array.from({ length: WINDOW_MONTHS }, (_, i) =>
    addMonths(current, i - WINDOW_MONTHS),
  )
  const recent = new Set(window.slice(-3))
  const inWindow = new Set(window)
  const installments = new Set(purchases.filter((p) => p.parcelas > 1).map((p) => p.id))

  type Group = {
    byMonth: Map<MonthKey, { total: number; count: number }>
    categories: Map<string, number>
    last: Movement | null
    esteMes: number
    recurrence: Recurrence | null
  }
  const groups = new Map<string, Group>()
  const group = (key: string) => {
    let found = groups.get(key)
    if (!found) {
      found = {
        byMonth: new Map(),
        categories: new Map(),
        last: null,
        esteMes: 0,
        recurrence: null,
      }
      groups.set(key, found)
    }
    return found
  }

  for (const movement of movements) {
    // Só gastos meus; uma compra parcelada repete-se, mas não é um gasto recorrente
    if (movement.tipo !== tipo || movement.pessoa_id) continue
    if (movement.compra_id && installments.has(movement.compra_id)) continue
    if (movement.data > today) continue
    const key =
      descriptionKey(movement.descricao) ||
      (movement.recorrencia_id ? `r:${movement.recorrencia_id}` : '')
    if (!key) continue
    const month = movement.data.slice(0, 7)
    if (!inWindow.has(month) && month !== current) continue
    const g = group(key)
    if (month === current) g.esteMes += movement.valor_centavos
    else {
      const row = g.byMonth.get(month) ?? { total: 0, count: 0 }
      row.total += movement.valor_centavos
      row.count += 1
      g.byMonth.set(month, row)
      g.categories.set(movement.category_id, (g.categories.get(movement.category_id) ?? 0) + 1)
    }
    if (!g.last || movement.data >= g.last.data) g.last = movement
  }

  for (const recurrence of recurrences) {
    if (!recurrence.ativa || recurrence.tipo !== tipo) continue
    group(descriptionKey(recurrence.descricao) || `r:${recurrence.id}`).recurrence = recurrence
  }

  const items: RepeatingExpense[] = []
  for (const [key, g] of groups) {
    const months = [...g.byMonth.entries()]
    const recentCount = months.filter(([month]) => recent.has(month)).length
    const detected = months.length >= MIN_MONTHS && recentCount >= MIN_RECENT
    if (!detected && !g.recurrence) continue
    const totals = months.map(([, row]) => row.total)
    const mensal = detected
      ? median(totals)
      : g.recurrence!.frequencia === 'anual'
        ? Math.round(g.recurrence!.valor_centavos / 12)
        : g.recurrence!.valor_centavos
    const max = Math.max(...totals, 0)
    const min = Math.min(...totals, max)
    const topCategory = [...g.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    items.push({
      key,
      nome: g.last?.descricao || g.recurrence?.descricao || key,
      // A categoria do recorrente cadastrado manda: é a escolha mais recente de quem usa a app
      categoryId: g.recurrence?.category_id ?? topCategory ?? '',
      mensal,
      vezesPorMes: months.length
        ? Math.round((months.reduce((sum, [, row]) => sum + row.count, 0) / months.length) * 10) /
          10
        : 1,
      fixo: detected ? max === 0 || (max - min) / max <= 0.1 : true,
      meses: months.length,
      registada: Boolean(g.recurrence),
      esteMes: g.esteMes,
      ultimaData: g.last?.data ?? null,
    })
  }
  items.sort((a, b) => b.mensal - a.mensal)
  return items
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}
