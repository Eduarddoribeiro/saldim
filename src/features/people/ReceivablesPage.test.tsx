// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { Invoice } from '@/features/invoices/invoices-api'
import type { LedgerMovement } from '@/features/transactions/transactions-api'
import { renderApp } from '@/test/render-app'
import { createReimbursement, updatePerson, type Person, type Reimbursement } from './people-api'

const store = vi.hoisted(() => ({
  people: [] as Person[],
  reimbursements: [] as Reimbursement[],
  movements: [] as LedgerMovement[],
  purchases: [] as CardPurchase[],
  invoices: [] as Invoice[],
  accounts: [] as Account[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => []),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listBalanceMovements: vi.fn(async () => store.movements),
}))
vi.mock('@/features/card-purchases/purchases-api', () => ({
  listPurchases: vi.fn(async () => store.purchases),
}))
vi.mock('@/features/invoices/invoices-api', () => ({
  listInvoices: vi.fn(async () => store.invoices),
}))
vi.mock('./people-api', () => ({
  listPeople: vi.fn(async () => store.people),
  listReimbursements: vi.fn(async () => store.reimbursements),
  createReimbursement: vi.fn(async () => ({})),
  updatePerson: vi.fn(async (id: string, patch: Partial<Person>) => {
    const item = store.people.find((p) => p.id === id)!
    Object.assign(item, patch)
    return item
  }),
  deleteReimbursement: vi.fn(async () => {}),
}))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

const person = (id: string, nome: string, arquivada = false): Person => ({
  id,
  user_id: 'u',
  nome,
  arquivada,
  divida_anterior_centavos: 0,
  created_at: '',
})

const parcela = (
  pessoa_id: string,
  valor: number,
  fatura_id: string,
  compra_id = 'c1',
  account_id = 'visa',
): LedgerMovement => ({
  account_id,
  compra_id,
  category_id: 'alim',
  tipo: 'despesa',
  valor_centavos: valor,
  data: '2026-10-01',
  pessoa_id,
  fatura_id,
})

const invoice = (id: string, vencimento: string): Invoice => ({
  id,
  account_id: 'visa',
  mes_referencia: `${vencimento.slice(0, 7)}-01`,
  data_fechamento: vencimento,
  data_vencimento: vencimento,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 19, 12, 0))
  vi.mocked(createReimbursement).mockClear()
  store.accounts = [
    {
      id: 'picpay',
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
    ...['visa', 'nubank'].map((id) => ({
      id,
      user_id: 'u',
      nome: id === 'visa' ? 'Visa' : 'Nubank',
      tipo: 'cartao_credito' as const,
      saldo_inicial_centavos: 0,
      arquivada: false,
      created_at: '',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 500000,
      conta_pagamento_id: 'picpay',
    })),
  ]
  store.people = [person('mae', 'Mãe'), person('primo', 'Primo'), person('tia', 'Tia', true)]
  store.invoices = [invoice('out', '2026-10-10'), invoice('nov', '2026-11-10')]
  // Mãe: 100,00 vencidos + 200,00 futuros, devolveu 30,00. Primo: nada ainda.
  store.movements = [parcela('mae', 10000, 'out'), parcela('mae', 20000, 'nov')]
  store.reimbursements = [
    {
      id: 'r1',
      user_id: 'u',
      pessoa_id: 'mae',
      account_id: 'picpay',
      valor_centavos: 3000,
      data: '2026-10-15',
      descricao: 'Pix',
      created_at: '',
    },
  ]
  store.purchases = [
    {
      id: 'c1',
      user_id: 'u',
      account_id: 'visa',
      category_id: 'alim',
      descricao: 'Sofá',
      data_compra: '2026-09-28',
      valor_total_centavos: 30000,
      parcelas: 2,
      parcela_inicial: 1,
      pessoa_id: 'mae',
      created_at: '',
    },
  ]
})

afterEach(() => {
  vi.useRealTimers()
})

describe('A receber', () => {
  it('mostra quanto cada pessoa deve, o que já venceu, as compras e os pagamentos', async () => {
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })
    // 300,00 − 30,00; vencido 100,00 − 30,00
    expect(plain(mae.textContent)).toContain('Deve R$ 270,00')
    expect(plain(mae.textContent)).toContain('Já vencido: R$ 70,00 · em faturas futuras: R$ 200,00')
    const compras = within(mae).getByRole('list', { name: 'Compras de Mãe' })
    expect(plain(compras.textContent)).toBe(
      'SofáVisa · 28/09/2026 · 2× · faltam 1 de 2R$ 300,00Faturas vencidas R$ 100,00Faturas futuras R$ 200,00',
    )
    const pagamentos = within(mae).getByRole('list', { name: 'Pagamentos de Mãe' })
    expect(plain(pagamentos.textContent)).toContain('Pix15/10/2026 · PicPay+R$ 30,00')

    // O primo ainda não comprou nada; a tia está arquivada e em dia (fica à parte)
    expect(plain(screen.getByRole('region', { name: 'Primo' }).textContent)).toContain('Em dia')
    expect(screen.queryByRole('region', { name: 'Tia' })).not.toBeInTheDocument()
    expect(screen.getByText('Arquivadas (1)')).toBeInTheDocument()
  })

  it('detalhe por cartão e filtros por cartão, tipo e situação', async () => {
    // Mais uma compra da mãe: à vista no Nubank, já vencida
    store.purchases.push({
      ...store.purchases[0],
      id: 'c2',
      account_id: 'nubank',
      descricao: 'Gás',
      data_compra: '2026-09-23',
      valor_total_centavos: 12500,
      parcelas: 1,
    })
    store.movements.push(parcela('mae', 12500, 'out', 'c2', 'nubank'))
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })

    const porCartao = within(mae).getByRole('table', { name: 'Compras de Mãe por cartão' })
    expect(
      within(porCartao)
        .getAllByRole('row')
        .map((row) => plain(row.textContent)),
    ).toEqual([
      'CartãoFaturas vencidasFaturas futurasTotal',
      'VisaR$ 100,00R$ 200,00R$ 300,00',
      'NubankR$ 125,00R$ 0,00R$ 125,00',
      'TodosR$ 225,00R$ 200,00R$ 425,00',
    ])

    const compras = () =>
      within(within(mae).getByRole('list', { name: 'Compras de Mãe' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent?.split(' · ')[0])
    expect(compras()).toEqual(['SofáVisa', 'GásNubank'])

    await userEvent.selectOptions(within(mae).getByLabelText('Cartão'), 'Nubank')
    expect(compras()).toEqual(['GásNubank'])
    expect(plain(within(mae).getByRole('status').textContent)).toBe(
      '1 de 2 compras · faturas vencidas R$ 125,00 · faturas futuras R$ 0,00',
    )

    await userEvent.selectOptions(within(mae).getByLabelText('Cartão'), 'Todos')
    await userEvent.selectOptions(within(mae).getByLabelText('Tipo'), 'Parceladas')
    expect(compras()).toEqual(['SofáVisa'])

    await userEvent.selectOptions(within(mae).getByLabelText('Tipo'), 'Todas')
    await userEvent.selectOptions(within(mae).getByLabelText('Situação'), 'Todas já vencidas')
    expect(compras()).toEqual(['GásNubank'])
  })

  it('"Recebi" sugere o que já venceu e regista o pagamento na conta escolhida', async () => {
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })
    await userEvent.click(within(mae).getByRole('button', { name: 'Recebi' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pagamento de Mãe' })
    expect(within(dialog).getByLabelText('Valor')).toHaveValue('70,00')
    expect(within(dialog).getByLabelText('Conta onde entrou')).toHaveValue('picpay')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pagamento' }))
    await waitFor(() =>
      expect(createReimbursement).toHaveBeenCalledWith({
        pessoaId: 'mae',
        accountId: 'picpay',
        valor: 7000,
        data: '2026-10-19',
        descricao: '',
      }),
    )
  })

  it('não aceita um pagamento com data futura', async () => {
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })
    await userEvent.click(within(mae).getByRole('button', { name: 'Recebi' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pagamento de Mãe' })
    const data = within(dialog).getByLabelText('Data')
    await userEvent.clear(data)
    await userEvent.type(data, '2026-10-25')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pagamento' }))
    expect(
      await within(dialog).findByText('Um pagamento recebido não pode ter data futura.'),
    ).toBeInTheDocument()
    expect(createReimbursement).not.toHaveBeenCalled()
  })

  it('dívida anterior (D23): soma ao que deve e conta como já vencida', async () => {
    store.people[0].divida_anterior_centavos = 50000
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })
    // 270,00 + 500,00; vencido 70,00 + 500,00
    expect(plain(mae.textContent)).toContain('Deve R$ 770,00')
    expect(plain(mae.textContent)).toContain('Já vencido: R$ 570,00')
    expect(plain(mae.textContent)).toContain('Dívida anterior: R$ 500,00')
  })

  it('edita a dívida anterior de uma pessoa', async () => {
    renderApp('/a-receber')
    const mae = await screen.findByRole('region', { name: 'Mãe' })
    await userEvent.click(within(mae).getByRole('button', { name: 'Editar Mãe' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar pessoa' })
    const campo = within(dialog).getByLabelText('Dívida anterior')
    expect(campo).toHaveValue('0,00')
    await userEvent.clear(campo)
    await userEvent.type(campo, '412,30')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(updatePerson).toHaveBeenCalledWith('mae', {
        nome: 'Mãe',
        divida_anterior_centavos: 41230,
      }),
    )
  })

  it('sem pessoas: explica como começar', async () => {
    store.people = []
    store.movements = []
    store.reimbursements = []
    renderApp('/a-receber')
    expect(await screen.findByText('Ninguém te deve nada')).toBeInTheDocument()
  })
})
