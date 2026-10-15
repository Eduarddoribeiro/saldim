// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import type { Transaction } from '@/features/transactions/transactions-api'
import { UserFacingError } from '@/lib/db-errors'
import { renderApp } from '@/test/render-app'
import type { CardPurchase } from './purchases-api'

const store = vi.hoisted(() => ({
  transactions: [] as Transaction[],
  purchases: [] as CardPurchase[],
  accounts: [] as Account[],
  registerError: null as Error | null,
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => [
    category('alim', 'Alimentação', 'despesa'),
    category('sal', 'Salário', 'receita'),
  ]),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listTransactions: vi.fn(async (month: string) =>
    store.transactions.filter((t) => t.data.startsWith(month)),
  ),
}))
vi.mock('./purchases-api', () => ({
  listPurchases: vi.fn(async () => store.purchases),
  registerPurchase: vi.fn(async () => {
    if (store.registerError) throw store.registerError
    return 'nova'
  }),
  deletePurchase: vi.fn(async (id: string) => {
    store.purchases = store.purchases.filter((p) => p.id !== id)
    store.transactions = store.transactions.filter((t) => t.compra_id !== id)
  }),
}))

const { registerPurchase, deletePurchase } = await import('./purchases-api')

function category(id: string, nome: string, tipo: Category['tipo']): Category {
  return {
    id,
    nome,
    tipo,
    arquivada: false,
    user_id: 'u',
    cor: 'slate',
    icone: 'tag',
    created_at: '',
  }
}

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

const visa = () =>
  account({
    id: 'visa',
    nome: 'Visa',
    tipo: 'cartao_credito',
    dia_fechamento: 25,
    dia_vencimento: 5,
    limite_centavos: 500000,
    conta_pagamento_id: 'conta',
  })

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  store.registerError = null
  store.accounts = [account({}), visa()]
  store.purchases = [
    {
      id: 'tv',
      user_id: 'u',
      account_id: 'visa',
      category_id: 'alim',
      descricao: 'Televisão',
      data_compra: '2026-09-10',
      valor_total_centavos: 10000,
      parcelas: 3,
      parcela_inicial: 1,
      created_at: '',
    },
  ]
  store.transactions = [
    {
      id: 'p2',
      user_id: 'u',
      account_id: 'visa',
      category_id: 'alim',
      tipo: 'despesa',
      valor_centavos: 3333,
      data: '2026-10-10',
      descricao: 'Televisão',
      created_at: '',
      fatura_id: 'f',
      compra_id: 'tv',
      parcela_numero: 2,
    },
  ]
  vi.mocked(registerPurchase).mockClear()
  vi.mocked(deletePurchase).mockClear()
})

afterEach(() => vi.useRealTimers())

async function openPurchaseForm() {
  renderApp('/transacoes')
  await userEvent.click(await screen.findByRole('button', { name: 'Compra no cartão' }))
  return screen.findByRole('dialog', { name: 'Compra no cartão' })
}

describe('compras no cartão', () => {
  it('o botão só aparece com um cartão ativo', async () => {
    store.accounts = [account({}), { ...visa(), arquivada: true }]
    renderApp('/transacoes')
    await screen.findByRole('button', { name: /Televisão/ })
    expect(screen.queryByRole('button', { name: 'Compra no cartão' })).not.toBeInTheDocument()
  })

  it('a parcela aparece na lista como "Parcela 2/3" do cartão', async () => {
    renderApp('/transacoes')
    const linha = await screen.findByRole('button', { name: /Televisão/ })
    await waitFor(() => expect(linha).toHaveTextContent('Alimentação · Visa · Parcela 2/3'))
    expect(plain(linha.textContent)).toContain('-R$ 33,33')
    expect(linha).toHaveAccessibleName(/Ver compra$/)
  })

  it('pré-visualiza as parcelas e as faturas e regista a compra em centavos', async () => {
    const dialog = await openPurchaseForm()
    // Só há um cartão: vem escolhido
    expect(within(dialog).getByLabelText('Cartão')).toHaveValue('visa')
    expect(within(dialog).getByText(/Indica o valor, as parcelas e a data/)).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Valor total'), '100,00')
    await userEvent.selectOptions(within(dialog).getByLabelText('Número de parcelas'), '3')
    await userEvent.type(within(dialog).getByLabelText('Descrição (opcional)'), 'Sofá')
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoria'), 'alim')
    const data = within(dialog).getByLabelText('Data da compra')
    await userEvent.clear(data)
    await userEvent.type(data, '2026-10-25')

    // Compra no dia do fechamento (25) → fatura seguinte (vence a 5 de dezembro)
    expect(plain(within(dialog).getByRole('status').textContent)).toBe(
      '3× R$ 33,33 (a última R$ 33,34)',
    )
    const parcelas = within(within(dialog).getByRole('list', { name: 'Parcelas' })).getAllByRole(
      'listitem',
    )
    expect(parcelas.map((li) => plain(li.textContent))).toEqual([
      '1/3 fatura de dez 2026 · vence 05/12/2026R$ 33,33',
      '2/3 fatura de jan 2027 · vence 05/01/2027R$ 33,33',
      '3/3 fatura de fev 2027 · vence 05/02/2027R$ 33,34',
    ])

    await userEvent.click(within(dialog).getByRole('button', { name: 'Registar compra' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(registerPurchase).toHaveBeenCalledWith({
      cardId: 'visa',
      valor: 10000,
      parcelas: 3,
      parcelaInicial: 1,
      data: '2026-10-25',
      categoryId: 'alim',
      descricao: 'Sofá',
    })
  })

  it('compra em curso: escolhe a primeira parcela por pagar e só essas aparecem', async () => {
    const dialog = await openPurchaseForm()
    await userEvent.type(within(dialog).getByLabelText('Valor total'), '600,01')
    await userEvent.selectOptions(within(dialog).getByLabelText('Número de parcelas'), '6')
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoria'), 'alim')
    await userEvent.click(within(dialog).getByLabelText(/Compra já em curso/))
    await userEvent.selectOptions(within(dialog).getByLabelText('Primeira parcela por pagar'), '4')

    expect(plain(within(dialog).getByRole('status').textContent)).toBe(
      '6× R$ 100,00 (a última R$ 100,01) · da 4.ª à 6.ª: R$ 300,01',
    )
    expect(
      within(within(dialog).getByRole('list', { name: 'Parcelas' })).getAllByRole('listitem'),
    ).toHaveLength(3)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Registar compra' }))
    await waitFor(() =>
      expect(registerPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 60001, parcelas: 6, parcelaInicial: 4 }),
      ),
    )
  })

  it('valida antes de enviar e mostra o erro do servidor', async () => {
    const dialog = await openPurchaseForm()
    await userEvent.type(within(dialog).getByLabelText('Valor total'), '0,02')
    await userEvent.selectOptions(within(dialog).getByLabelText('Número de parcelas'), '3')
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoria'), 'alim')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registar compra' }))
    expect(
      await within(dialog).findByText('O valor não chega para todas as parcelas (1 centavo cada).'),
    ).toBeInTheDocument()
    expect(registerPurchase).not.toHaveBeenCalled()

    store.registerError = new UserFacingError('As parcelas passariam do ano 2999.')
    const valor = within(dialog).getByLabelText('Valor total')
    await userEvent.clear(valor)
    await userEvent.type(valor, '30,00')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registar compra' }))
    expect(
      await within(dialog).findByText('As parcelas passariam do ano 2999.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Compra no cartão' })).toBeInTheDocument()
  })

  it('tocar numa parcela abre a compra; apagar pede confirmação e apaga a compra inteira', async () => {
    renderApp('/transacoes')
    await userEvent.click(await screen.findByRole('button', { name: /Televisão/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Televisão' })
    expect(plain(dialog.textContent)).toContain('CartãoVisa')
    expect(plain(dialog.textContent)).toContain('Valor totalR$ 100,00')
    expect(
      within(within(dialog).getByRole('list', { name: 'Parcelas' })).getAllByRole('listitem'),
    ).toHaveLength(3)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Apagar' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('As 3 parcelas são apagadas com a compra.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Apagar' }))

    await waitFor(() => expect(deletePurchase).toHaveBeenCalledWith('tv'))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Televisão/ })).not.toBeInTheDocument(),
    )
  })
})
