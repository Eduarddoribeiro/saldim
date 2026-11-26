// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
vi.mock('@/features/accounts/accounts-api', () => ({ listAccounts: vi.fn(async () => []) }))

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

describe('Fixos: descobertos pela app', () => {
  it('mostra o que entra, o que sai e o que sobra, por área, e os descobertos para cadastrar', async () => {
    renderApp('/fixos')
    const resumo = await screen.findByRole('region', { name: 'Resumo dos fixos' })
    // Entra: salário 5.000; sai: Netflix 44,90 + mercado (mediana 375,00) = 419,90
    expect(plain(resumo.textContent)).toContain('R$ 4.580,10')
    expect(plain(resumo.textContent)).toContain('R$ 5.000,00')
    expect(plain(resumo.textContent)).toContain('R$ 419,90')

    const saidas = within(screen.getByRole('list', { name: 'Saídas descobertas' }))
    expect(saidas.getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual([
      'MercadoTodo mês · Alimentação · valor varia (média)R$ 375,00por mês',
      'NetflixTodo mês · LazerR$ 44,90por mês',
    ])
    const entradas = within(screen.getByRole('list', { name: 'Entradas descobertas' }))
    expect(plain(entradas.getByRole('listitem').textContent)).toContain('Salário')

    const areas = within(screen.getByRole('list', { name: 'Gastos por área' }))
    expect(areas.getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual([
      'AlimentaçãoR$ 375,00 · 89%Mercado',
      'LazerR$ 44,90 · 11%Netflix',
    ])
  })

  it('"Cadastrar" abre o formulário já preenchido', async () => {
    renderApp('/fixos')
    await userEvent.click(await screen.findByRole('button', { name: /^Netflix: .*Cadastrar$/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo fixo' })
    expect(within(dialog).getByLabelText('Nome')).toHaveValue('Netflix')
    expect(within(dialog).getByLabelText('Valor')).toHaveValue('44,90')
    expect(within(dialog).getByLabelText('Categoria')).toHaveValue('lazer')
  })

  it('sem nada cadastrado nem que se repita, explica', async () => {
    store.history = []
    renderApp('/fixos')
    expect(await screen.findByText('Nenhum fixo ainda')).toBeInTheDocument()
  })

  it('os endereços antigos levam a Fixos', async () => {
    const { router } = renderApp('/gastos-fixos')
    expect(router.state.location.pathname).toBe('/fixos')
  })
})
