// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '@/features/categories/categories-api'
import type { Transaction } from '@/features/transactions/transactions-api'
import { renderApp } from '@/test/render-app'
import type { Budget } from './budgets-api'

const store = vi.hoisted(() => ({
  budgets: [] as Budget[],
  categories: [] as Category[],
  transactions: [] as Transaction[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => store.categories),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listTransactions: vi.fn(async (month: string) =>
    store.transactions.filter((t) => t.data.startsWith(month)),
  ),
}))
vi.mock('./budgets-api', () => ({
  listBudgets: vi.fn(async (month: string) => store.budgets.filter((b) => b.mes === `${month}-01`)),
  createBudget: vi.fn(async (input: { categoryId: string; month: string; limite: number }) => {
    const created = budget(input.categoryId, `${input.month}-01`, input.limite)
    store.budgets.push(created)
    return created
  }),
  updateBudget: vi.fn(async (id: string, limite: number) => {
    const found = store.budgets.find((b) => b.id === id)!
    found.limite_centavos = limite
    return found
  }),
  deleteBudget: vi.fn(async (id: string) => {
    store.budgets = store.budgets.filter((b) => b.id !== id)
  }),
  copyBudgets: vi.fn(async (from: string, to: string) => {
    const existing = new Set(
      store.budgets.filter((b) => b.mes === `${to}-01`).map((b) => b.category_id),
    )
    const copies = store.budgets
      .filter((b) => b.mes === `${from}-01` && !existing.has(b.category_id))
      .map((b) => budget(b.category_id, `${to}-01`, b.limite_centavos))
    store.budgets.push(...copies)
    return copies.length
  }),
}))

let counter = 0
function budget(categoryId: string, mes: string, limite: number): Budget {
  return {
    id: `b${counter++}`,
    user_id: 'u',
    category_id: categoryId,
    mes,
    limite_centavos: limite,
    created_at: '',
  }
}
const category = (id: string, nome: string, tipo: Category['tipo'] = 'despesa'): Category => ({
  id,
  nome,
  tipo,
  arquivada: false,
  user_id: 'u',
  cor: 'slate',
  icone: 'tag',
  created_at: '',
})
const despesa = (categoryId: string, valor: number, data = '2026-10-10'): Transaction => ({
  id: `t${counter++}`,
  user_id: 'u',
  account_id: 'conta',
  category_id: categoryId,
  tipo: 'despesa',
  valor_centavos: valor,
  data,
  descricao: '',
  created_at: '',
  fatura_id: null,
  compra_id: null,
  parcela_numero: null,
})
const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  store.categories = [
    category('alim', 'Alimentação'),
    category('casa', 'Moradia'),
    category('lazer', 'Lazer'),
    category('sal', 'Salário', 'receita'),
  ]
  store.budgets = [
    budget('alim', '2026-10-01', 100000), // gasto 85 % → alerta
    budget('casa', '2026-10-01', 150000), // gasto 120 % → excedido
    budget('lazer', '2026-09-01', 20000), // só no mês anterior
  ]
  store.transactions = [despesa('alim', 85000), despesa('casa', 180000), despesa('lazer', 5000)]
})

afterEach(() => vi.useRealTimers())

/** Botão "Definir" de uma categoria sem orçamento (pesquisa dentro da secção: mais rápido no jsdom). */
const defineButton = async (nome: string) =>
  within(await screen.findByRole('region', { name: 'Sem orçamento' })).getByRole('button', {
    name: `Definir orçamento de ${nome}`,
  })

const row = (name: RegExp) =>
  within(screen.getByRole('region', { name: 'Com orçamento' })).getByRole('button', { name })

describe('página de orçamentos', () => {
  it('mostra gasto, limite, estado (texto + ícone) e o que resta ou passou', async () => {
    renderApp('/orcamentos')
    await screen.findByRole('region', { name: 'Com orçamento' })

    const alim = plain(row(/Alimentação/).textContent)
    expect(alim).toContain('R$ 850,00 de R$ 1.000,00')
    expect(alim).toContain('Perto do limite · 85%')
    expect(alim).toContain('Restam R$ 150,00')

    const casa = plain(row(/Moradia/).textContent)
    expect(casa).toContain('Excedido · 120%')
    expect(casa).toContain('Passou R$ 300,00')

    // A barra de progresso é anunciada a leitores de ecrã (limitada a 100)
    const barra = within(row(/Moradia/)).getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '100')
    expect(barra).toHaveAttribute('aria-valuetext', '120% do limite')

    expect(plain(screen.getByText(/^Total:/).textContent)).toBe(
      'Total: R$ 2.650,00 gasto de R$ 2.500,00',
    )
  })

  it('lista só categorias de despesa ativas sem orçamento, com o gasto', async () => {
    renderApp('/orcamentos')
    const sem = await screen.findByRole('region', { name: 'Sem orçamento' })
    expect(
      within(sem)
        .getAllByRole('listitem')
        .map((li) => plain(li.textContent)),
    ).toEqual(['LazerGasto: R$ 50,00Definir'])
  })

  it('define um orçamento novo em centavos', async () => {
    renderApp('/orcamentos')
    await userEvent.click(await defineButton('Lazer'))
    const dialog = await screen.findByRole('dialog', { name: 'Definir orçamento' })
    await userEvent.type(within(dialog).getByLabelText('Limite mensal'), '250,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(row(/Lazer/)).toBeInTheDocument())
    expect(store.budgets.at(-1)).toMatchObject({
      category_id: 'lazer',
      mes: '2026-10-01',
      limite_centavos: 25050,
    })
  })

  it('recusa limite zero', async () => {
    renderApp('/orcamentos')
    await userEvent.click(await defineButton('Lazer'))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Limite mensal'), '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('O valor tem de ser maior que zero.')).toBeInTheDocument()
  })

  it('edita e remove um orçamento existente', async () => {
    renderApp('/orcamentos')
    await screen.findByRole('region', { name: 'Com orçamento' })
    await userEvent.click(row(/Alimentação/))
    const dialog = await screen.findByRole('dialog', { name: 'Editar orçamento' })
    expect(within(dialog).getByLabelText('Limite mensal')).toHaveValue('1000,00')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Apagar' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Apagar' }))
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Sem orçamento' })).getByText('Alimentação'),
      ).toBeInTheDocument(),
    )
  })

  it('copia do mês anterior só o que falta', async () => {
    renderApp('/orcamentos')
    expect(
      await screen.findByText('1 orçamento de setembro de 2026 ainda não está definido neste mês.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar de setembro de 2026' }))

    expect(await screen.findByText('1 orçamento copiado.')).toBeInTheDocument()
    await waitFor(() => expect(row(/Lazer/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Copiar de/ })).not.toBeInTheDocument()
  })

  it('mês sem orçamentos mostra um estado vazio', async () => {
    renderApp('/orcamentos?mes=2026-06')
    expect(await screen.findByText('Sem orçamentos em junho de 2026')).toBeInTheDocument()
  })

  it('aparece na navegação', async () => {
    const { router } = renderApp('/configuracoes')
    const [nav] = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    await userEvent.click(within(nav).getByRole('link', { name: 'Orçamentos' }))
    expect(router.state.location.pathname).toBe('/orcamentos')
  })
})
