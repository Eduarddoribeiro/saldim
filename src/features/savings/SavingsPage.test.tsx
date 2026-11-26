// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'

const store = vi.hoisted(() => ({ history: [] as unknown[], accounts: [] as unknown[] }))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Edu', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listImportHistory: vi.fn(async () => store.history),
  listBalanceMovements: vi.fn(async () => store.history),
}))
vi.mock('@/features/card-purchases/purchases-api', () => ({ listPurchases: vi.fn(async () => []) }))
vi.mock('@/features/recurring/recurring-api', () => ({ listRecurring: vi.fn(async () => []) }))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
vi.mock('@/features/transfers/transfers-api', () => ({ listTransfers: vi.fn(async () => []) }))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')
const mov = (
  descricao: string,
  data: string,
  valor: number,
  tipo = 'despesa',
  account_id = 'conta',
) => ({
  account_id,
  category_id: 'c',
  tipo,
  valor_centavos: valor,
  data,
  descricao,
  pessoa_id: null,
  compra_id: null,
  recorrencia_id: null,
  fatura_id: null,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 26, 12, 0))
  const months = ['05', '06', '07', '08', '09', '10']
  // Entra 1.610 por mês; sai 682,07 fixo (faculdade) + mercado que não se repete igual
  store.history = [
    ...months.map((m) => mov('Salário', `2026-${m}-05`, 161000, 'receita')),
    ...months.map((m) => mov('Faculdade', `2026-${m}-08`, 68207)),
    mov('Loja de roupa', '2026-08-20', 76793),
    mov('Presente', '2026-09-20', 76793),
    mov('Conserto do celular', '2026-10-20', 76793),
    // 1.000 já guardados na poupança
    mov('Guardado', '2026-10-01', 100000, 'receita', 'poupanca'),
  ]
  store.accounts = [
    { id: 'conta', nome: 'Conta', tipo: 'corrente', saldo_inicial_centavos: 0, arquivada: false },
    {
      id: 'poupanca',
      nome: 'Caixinha',
      tipo: 'poupanca',
      saldo_inicial_centavos: 0,
      arquivada: false,
    },
  ]
})
afterEach(() => vi.useRealTimers())

describe('Guardar dinheiro', () => {
  it('sugere 30% da sobra, mostra a reserva de emergência e quanto rende', async () => {
    renderApp('/guardar')
    const guardar = await screen.findByRole('region', { name: 'Quanto guardar' })
    // Sobra: o que entra fixo (salário 1.610) − os fixos (faculdade 682,07)
    expect(plain(guardar.textContent)).toContain('Sobra do mêsR$ 927,93')
    expect(plain(guardar.textContent)).toContain('GuardarR$ 278,38')

    // Gasto médio 1.450 (682,07 + 767,93) → reserva de 3 meses 4.350; já tem 1.000
    const reserva = screen.getByRole('region', { name: 'Primeiro: reserva de emergência' })
    expect(plain(reserva.textContent)).toContain('R$ 1.450,00')
    expect(plain(reserva.textContent)).toContain('R$ 4.350,00')
    expect(plain(reserva.textContent)).toContain('Já tem R$ 1.000,00 · faltam R$ 3.350,00')
    expect(screen.getByRole('progressbar', { name: 'Reserva de emergência' })).toHaveAttribute(
      'aria-valuenow',
      '100000',
    )

    const rende = within(screen.getByRole('list', { name: 'Quanto rende em cada aplicação' }))
    const nomes = rende.getAllByRole('listitem').map((li) => plain(li.textContent).split('R$')[0])
    expect(nomes.at(-1)).toBe('Poupança')
    await userEvent.click(screen.getByRole('button', { name: '5 anos' }))
    expect(screen.getByRole('button', { name: '5 anos' })).toHaveAttribute('aria-pressed', 'true')
    expect(plain(screen.getByRole('region', { name: 'Quanto rende' }).textContent)).toContain(
      'você coloca R$ 16.702,80',
    )
  })

  it('a parte guardada muda com o controle', async () => {
    renderApp('/guardar')
    const slider = await screen.findByRole('slider', { name: 'Parte da sobra para guardar' })
    fireEvent.change(slider, { target: { value: '50' } })
    expect(plain(screen.getByRole('region', { name: 'Quanto guardar' }).textContent)).toContain(
      'GuardarR$ 463,97',
    )
  })
})
