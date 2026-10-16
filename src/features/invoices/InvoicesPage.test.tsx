// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { InvoiceItem } from '@/features/transactions/transactions-api'
import type { InvoicePayment } from '@/features/transfers/transfers-api'
import { renderApp } from '@/test/render-app'
import type { Invoice } from './invoices-api'

const store = vi.hoisted(() => ({
  accounts: [] as Account[],
  invoices: [] as Invoice[],
  items: [] as InvoiceItem[],
  payments: [] as InvoicePayment[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => [
    {
      id: 'alim',
      nome: 'Alimentação',
      tipo: 'despesa',
      arquivada: false,
      user_id: 'u',
      cor: 'slate',
      icone: 'tag',
      created_at: '',
    },
  ]),
}))
vi.mock('@/features/card-purchases/purchases-api', () => ({
  listPurchases: vi.fn(async () => [
    {
      id: 'tv',
      user_id: 'u',
      account_id: 'visa',
      category_id: 'alim',
      descricao: 'Televisão',
      data_compra: '2026-09-20',
      valor_total_centavos: 60000,
      parcelas: 3,
      parcela_inicial: 1,
      created_at: '',
    },
  ]),
}))
vi.mock('./invoices-api', () => ({ listInvoices: vi.fn(async () => store.invoices) }))
vi.mock('@/features/transactions/transactions-api', () => ({
  listInvoiceItems: vi.fn(async () => store.items),
}))
vi.mock('@/features/transfers/transfers-api', () => ({
  listInvoicePayments: vi.fn(async () => store.payments),
  createPayment: vi.fn(async () => {}),
  deletePayment: vi.fn(async (id: string) => {
    store.payments = store.payments.filter((p) => p.id !== id)
  }),
}))

const { createPayment, deletePayment } = await import('@/features/transfers/transfers-api')

function account(overrides: Partial<Account>): Account {
  return {
    id: 'conta',
    user_id: 'u',
    nome: 'Conta principal',
    tipo: 'corrente',
    saldo_inicial_centavos: 0,
    arquivada: false,
    created_at: '',
    dia_fechamento: null,
    dia_vencimento: null,
    limite_centavos: null,
    conta_pagamento_id: null,
    ...overrides,
  }
}

const fatura = (id: string, mes: string, fechamento: string, vencimento: string): Invoice => ({
  id,
  account_id: 'visa',
  mes_referencia: `${mes}-01`,
  data_fechamento: fechamento,
  data_vencimento: vencimento,
})
const parcela = (fatura_id: string, n: number, valor: number): InvoiceItem => ({
  id: `${fatura_id}-${n}`,
  fatura_id,
  compra_id: 'tv',
  parcela_numero: n,
  valor_centavos: valor,
  data: '2026-09-20',
  descricao: 'Televisão',
  category_id: 'alim',
})
const pagamento = (id: string, fatura_id: string, valor: number): InvoicePayment => ({
  id,
  fatura_id,
  conta_origem_id: 'conta',
  valor_centavos: valor,
  data: '2026-10-01',
  descricao: '',
})

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  // Hoje: 14/10/2026
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  store.accounts = [
    account({}),
    account({ id: 'poupanca', nome: 'Poupança' }),
    account({
      id: 'visa',
      nome: 'Visa',
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 500000,
      conta_pagamento_id: 'conta',
    }),
  ]
  store.invoices = [
    fatura('set', '2026-09', '2026-08-25', '2026-09-05'), // vencida, por pagar
    fatura('out', '2026-10', '2026-09-25', '2026-10-05'), // paga
    fatura('nov', '2026-11', '2026-10-25', '2026-11-05'), // aberta, paga em parte
  ]
  store.items = [parcela('set', 1, 30000), parcela('out', 1, 10000), parcela('nov', 2, 20000)]
  store.payments = [pagamento('p-out', 'out', 10000), pagamento('p-nov', 'nov', 5000)]
  vi.mocked(createPayment).mockClear()
  vi.mocked(deletePayment).mockClear()
})

afterEach(() => vi.useRealTimers())

const rows = () =>
  within(screen.getByRole('list', { name: 'Faturas' }))
    .getAllByRole('button')
    .map((row) => plain(row.textContent))

describe('página de faturas', () => {
  it('sem cartões, explica e liga às contas', async () => {
    store.accounts = [account({})]
    renderApp('/faturas')
    expect(await screen.findByText('Ainda não tens cartões de crédito')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para as contas' })).toHaveAttribute(
      'href',
      '/configuracoes/contas',
    )
  })

  it('por pagar: a que vence primeiro em cima, com o estado escrito e o total em aberto', async () => {
    renderApp('/faturas')
    await screen.findByRole('list', { name: 'Faturas' })
    expect(rows()).toEqual([
      'Setembro de 2026Fecha 25/08 · vence 05/09VencidaR$ 300,00',
      'Novembro de 2026Fecha 25/10 · vence 05/11Abertafalta R$ 150,00R$ 200,00',
    ])
    expect(plain(screen.getByText(/^Por pagar:/).textContent)).toBe('Por pagar: R$ 450,00')

    await userEvent.click(screen.getByRole('button', { name: 'Pagas' }))
    expect(screen.getByRole('button', { name: 'Pagas' })).toHaveAttribute('aria-pressed', 'true')
    expect(rows()).toEqual(['Outubro de 2026Fecha 25/09 · vence 05/10PagaR$ 100,00'])
  })

  it('o detalhe mostra as compras (parcela k/n) e os pagamentos', async () => {
    renderApp('/faturas')
    await userEvent.click(await screen.findByRole('button', { name: /Fatura de novembro/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Fatura de novembro de 2026' })
    expect(plain(dialog.textContent)).toContain('TotalR$ 200,00')
    expect(plain(dialog.textContent)).toContain('PagoR$ 50,00')
    expect(plain(dialog.textContent)).toContain('Em abertoR$ 150,00')
    const compras = within(within(dialog).getByRole('list', { name: 'Compras da fatura' }))
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(compras).toEqual(['Televisão20/09/2026 · parcela 2/3R$ 200,00'])
    expect(within(dialog).getByRole('list', { name: 'Pagamentos da fatura' })).toHaveTextContent(
      'Conta principal',
    )
  })

  it('paga em parte: sugere o valor em aberto e a conta de pagamento do cartão', async () => {
    renderApp('/faturas')
    await userEvent.click(await screen.findByRole('button', { name: /Fatura de novembro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar fatura' }))
    const form = await screen.findByRole('dialog', { name: 'Pagar fatura de novembro de 2026' })
    expect(within(form).getByLabelText('Pagar a partir de')).toHaveValue('conta')
    // Só contas de dinheiro: o cartão não aparece
    expect(
      within(within(form).getByLabelText('Pagar a partir de'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Escolhe a conta…', 'Conta principal', 'Poupança'])
    const valor = within(form).getByLabelText('Valor')
    expect(valor).toHaveValue('150,00')

    await userEvent.clear(valor)
    await userEvent.type(valor, '100')
    await userEvent.click(within(form).getByRole('button', { name: 'Registar pagamento' }))
    await waitFor(() =>
      expect(createPayment).toHaveBeenCalledWith({
        faturaId: 'nov',
        cartaoId: 'visa',
        contaOrigemId: 'conta',
        valor: 10000,
        data: '2026-10-14',
        descricao: '',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('não aceita pagamentos com data futura (D10a)', async () => {
    renderApp('/faturas')
    await userEvent.click(await screen.findByRole('button', { name: /Fatura de setembro/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Pagar fatura' }))
    const form = await screen.findByRole('dialog', { name: /Pagar fatura de setembro/ })
    const data = within(form).getByLabelText('Data')
    await userEvent.clear(data)
    await userEvent.type(data, '2026-10-15')
    await userEvent.click(within(form).getByRole('button', { name: 'Registar pagamento' }))
    expect(
      await within(form).findByText('Um pagamento não pode ter data futura.'),
    ).toBeInTheDocument()
    expect(createPayment).not.toHaveBeenCalled()
  })

  it('apaga um pagamento depois de confirmar', async () => {
    renderApp('/faturas')
    await userEvent.click(await screen.findByRole('button', { name: /Fatura de novembro/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Fatura de novembro de 2026' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Apagar o pagamento de R\$\s50,00/ }),
    )
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Apagar' }))
    await waitFor(() => expect(deletePayment).toHaveBeenCalledWith('p-nov'))
  })
})
