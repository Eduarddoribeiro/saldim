// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import { closeDay } from './journey-api'

const store = vi.hoisted(() => ({
  closed: [] as string[],
  history: [] as unknown[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Edu', moeda: 'BRL', created_at: '' })),
}))
vi.mock('./journey-api', () => ({
  listClosedDays: vi.fn(async () => store.closed),
  closeDay: vi.fn(async (dia: string) => {
    store.closed = [...store.closed, dia]
  }),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => [
    {
      id: 'conta',
      user_id: 'u',
      nome: 'PicPay',
      tipo: 'corrente',
      saldo_inicial_centavos: 0,
      arquivada: false,
      created_at: '',
      dia_fechamento: null,
      dia_vencimento: null,
      limite_centavos: null,
      conta_pagamento_id: null,
    },
  ]),
}))
vi.mock('@/features/categories/categories-api', () => ({ listCategories: vi.fn(async () => []) }))
vi.mock('@/features/transactions/transactions-api', () => ({
  listImportHistory: vi.fn(async () => store.history),
  listBalanceMovements: vi.fn(async () => store.history),
  listInvoiceItems: vi.fn(async () => []),
  listTransactions: vi.fn(async () => []),
}))
vi.mock('@/features/transfers/transfers-api', () => ({
  listTransfers: vi.fn(async () => []),
  listAccountTransfers: vi.fn(async () => []),
  listInvoicePayments: vi.fn(async () => []),
}))
vi.mock('@/features/card-purchases/purchases-api', () => ({ listPurchases: vi.fn(async () => []) }))
vi.mock('@/features/recurring/recurring-api', () => ({ listRecurring: vi.fn(async () => []) }))
vi.mock('@/features/invoices/invoices-api', () => ({ listInvoices: vi.fn(async () => []) }))
vi.mock('@/features/people/people-api', () => ({
  listPeople: vi.fn(async () => []),
  listReimbursements: vi.fn(async () => []),
}))
vi.mock('@/features/dashboard/charts', () => ({
  MonthlyBarsChart: () => null,
  BalanceLineChart: () => null,
}))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')
const mov = (data: string, valor: number) => ({
  account_id: 'conta',
  category_id: 'c',
  tipo: 'despesa',
  valor_centavos: valor,
  data,
  descricao: 'Mercado',
  pessoa_id: null,
  compra_id: null,
  recorrencia_id: null,
  fatura_id: null,
})

beforeEach(() => {
  // Quinta-feira 26/11/2026
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 26, 12, 0))
  vi.mocked(closeDay).mockClear()
  store.closed = ['2026-11-23', '2026-11-24', '2026-11-25']
  store.history = [mov('2026-11-26', 2500)]
})
afterEach(() => vi.useRealTimers())

describe('Fechar o dia (Início)', () => {
  it('fecha o dia, celebra e mostra a sequência nova', async () => {
    renderApp('/')
    const hoje = await screen.findByRole('region', { name: 'Hoje, quinta 26/11' })
    expect(plain(hoje.textContent)).toContain('1 lançamento')
    const dias = within(within(hoje).getByRole('list', { name: 'Últimos 7 dias' }))
    expect(dias.getByRole('listitem', { name: 'terça 24/11: fechado' })).toBeInTheDocument()
    expect(dias.getByRole('listitem', { name: 'quinta 26/11: hoje' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /^Sua jornada: 3 dias seguidos, 3 estrelas/ }),
    ).toBeInTheDocument()

    await userEvent.click(within(hoje).getByRole('button', { name: /Lancei tudo de hoje/ }))
    expect(closeDay).toHaveBeenCalledWith('2026-11-26')
    const festa = await screen.findByRole('dialog', { name: 'Dia fechado!' })
    expect(plain(festa.textContent)).toContain('+1 estrela · 4 dias seguidos')
    await userEvent.click(within(festa).getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(plain(hoje.textContent)).toContain('Dia fechado · 4 dias seguidos'))
  })

  it('sem lançamentos hoje: "Não gastei nada" também fecha o dia', async () => {
    store.history = []
    renderApp('/')
    const hoje = await screen.findByRole('region', { name: 'Hoje, quinta 26/11' })
    expect(within(hoje).getByRole('button', { name: 'Lançar algo' })).toBeInTheDocument()
    await userEvent.click(within(hoje).getByRole('button', { name: 'Não gastei nada' }))
    expect(closeDay).toHaveBeenCalledWith('2026-11-26')
  })
})

describe('Sua jornada', () => {
  it('nível, calendário do mês, de onde vêm as estrelas e conquistas', async () => {
    renderApp('/jornada')
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nível 1 · Começando' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Mais 47 estrelas para Atento.')).toBeInTheDocument()
    const estrelas = within(screen.getByRole('list', { name: 'De onde vêm as estrelas' }))
    expect(plain(estrelas.getAllByRole('listitem')[0].textContent)).toBe('Dias fechados · +1 cada3')
    const conquistas = within(screen.getByRole('list', { name: 'Conquistas' }))
    expect(
      conquistas.getByRole('listitem', { name: 'Primeira estrela: ganha' }),
    ).toBeInTheDocument()
    expect(
      conquistas.getByRole('listitem', { name: '7 dias seguidos: trancada, faltam 4' }),
    ).toBeInTheDocument()
  })
})
