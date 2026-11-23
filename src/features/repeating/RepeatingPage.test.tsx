// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'

const store = vi.hoisted(() => ({ history: [] as unknown[] }))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => [
    {
      id: 'lazer',
      nome: 'Lazer',
      tipo: 'despesa',
      arquivada: false,
      user_id: 'u',
      cor: 'violet',
      icone: 'tag',
      created_at: '',
    },
    {
      id: 'alim',
      nome: 'Alimentação',
      tipo: 'despesa',
      arquivada: false,
      user_id: 'u',
      cor: 'orange',
      icone: 'tag',
      created_at: '',
    },
  ]),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listImportHistory: vi.fn(async () => store.history),
}))
vi.mock('@/features/card-purchases/purchases-api', () => ({ listPurchases: vi.fn(async () => []) }))
vi.mock('@/features/recurring/recurring-api', () => ({ listRecurring: vi.fn(async () => []) }))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')
const mov = (descricao: string, data: string, valor: number, extra: object = {}) => ({
  account_id: 'conta',
  category_id: 'lazer',
  tipo: 'despesa',
  valor_centavos: valor,
  data,
  descricao,
  pessoa_id: null,
  compra_id: null,
  recorrencia_id: null,
  ...extra,
})

beforeEach(() => {
  // Hoje: 23/11/2026; meses olhados: maio a outubro
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 23, 12, 0))
  const months = ['05', '06', '07', '08', '09', '10']
  store.history = [
    ...months.map((m) => mov('Netflix', `2026-${m}-12`, 4490)),
    ...months.map((m) =>
      mov('Mercado', `2026-${m}-03`, 30000 + Number(m) * 1000, { category_id: 'alim' }),
    ),
    ...['08', '09', '10'].map((m) =>
      mov('Salário', `2026-${m}-05`, 500000, { tipo: 'receita', category_id: 'sal' }),
    ),
  ]
})
afterEach(() => vi.useRealTimers())

describe('gastos que se repetem', () => {
  it('total por mês e por ano, a parte do que entra e as listas de valor fixo e que varia', async () => {
    renderApp('/gastos-fixos')
    const total = await screen.findByRole('region', { name: 'Total dos gastos que se repetem' })
    // Netflix 44,90 + Mercado (mediana de 350,00…400,00 = 375,00) = 419,90; 5000,00 de salário
    expect(plain(total.textContent)).toContain('R$ 419,90')
    expect(plain(total.textContent)).toContain('R$ 5.038,80')
    expect(plain(total.textContent)).toContain('8%')
    const fixo = screen.getByRole('region', { name: /^Valor fixo/ })
    expect(plain(within(fixo).getByRole('listitem').textContent)).toBe(
      'NetflixTodo mês · Lazer · Descoberto pela appR$ 44,90por mês',
    )
    const varia = screen.getByRole('region', { name: /^Valor que varia/ })
    expect(plain(varia.textContent)).toContain('Mercado')
    // Por área: Alimentação (375,00 = 89%) e Lazer (44,90 = 11%)
    const areas = within(screen.getByRole('list', { name: 'Gastos por área' }))
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(areas).toEqual(['AlimentaçãoR$ 375,00 · 89%Mercado', 'LazerR$ 44,90 · 11%Netflix'])
    expect(screen.getByText(/0 cadastrados em Recorrentes · 2 descobertos/)).toBeInTheDocument()
  })

  it('sem nada que se repita, explica quando um gasto aparece', async () => {
    store.history = []
    renderApp('/gastos-fixos')
    expect(await screen.findByText('Ainda não há gastos que se repetem')).toBeInTheDocument()
  })
})
