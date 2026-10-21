// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { renderApp } from '@/test/render-app'
import type { Transaction } from './transactions-api'

const store = vi.hoisted(() => ({
  transactions: [] as Transaction[],
  categories: [] as Category[],
  accounts: [] as Account[],
  months: [] as string[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => store.categories),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
// As compras no cartão têm testes próprios (card-purchases/CardPurchases.test.tsx)
vi.mock('@/features/card-purchases/purchases-api', () => ({
  listPurchases: vi.fn(async () => []),
}))
vi.mock('./transactions-api', () => ({
  listTransactions: vi.fn(async (month: string) => {
    store.months.push(month)
    return store.transactions
      .filter((t) => t.data.startsWith(month))
      .sort((a, b) => b.data.localeCompare(a.data))
  }),
  createTransaction: vi.fn(async (values: Record<string, unknown>) => {
    const created = transaction({
      id: `nova-${store.transactions.length}`,
      tipo: values.tipo as Transaction['tipo'],
      valor_centavos: values.valor as number,
      data: values.data as string,
      category_id: values.categoryId as string,
      account_id: values.accountId as string,
      descricao: values.descricao as string,
    })
    store.transactions.push(created)
    return created
  }),
  updateTransaction: vi.fn(async (id: string, values: Record<string, unknown>) => {
    const t = store.transactions.find((x) => x.id === id)!
    Object.assign(t, { valor_centavos: values.valor, descricao: values.descricao })
    return t
  }),
  deleteTransaction: vi.fn(async (id: string) => {
    store.transactions = store.transactions.filter((t) => t.id !== id)
  }),
}))

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't',
    user_id: 'u',
    account_id: 'conta',
    category_id: 'alim',
    tipo: 'despesa',
    valor_centavos: 1000,
    data: '2026-10-14',
    descricao: '',
    created_at: '2026-10-14T10:00:00Z',
    fatura_id: null,
    compra_id: null,
    parcela_numero: null,
    recorrencia_id: null,
    pessoa_id: null,
    ...overrides,
  }
}

const category = (
  id: string,
  nome: string,
  tipo: Category['tipo'],
  arquivada = false,
): Category => ({
  id,
  nome,
  tipo,
  arquivada,
  user_id: 'u',
  cor: 'slate',
  icone: 'tag',
  created_at: '',
})

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  // Só o relógio do Date é simulado (os temporizadores reais continuam, para o userEvent funcionar)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  store.months = []
  store.categories = [
    category('alim', 'Alimentação', 'despesa'),
    category('casa', 'Moradia', 'despesa'),
    category('velha', 'Antiga', 'despesa', true),
    category('sal', 'Salário', 'receita'),
  ]
  store.accounts = [
    {
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
    },
  ]
  store.transactions = [
    transaction({ id: 't1', descricao: 'Supermercado', valor_centavos: 12345, data: '2026-10-14' }),
    transaction({
      id: 't2',
      tipo: 'receita',
      category_id: 'sal',
      valor_centavos: 500000,
      data: '2026-10-05',
    }),
    transaction({
      id: 't3',
      descricao: 'Renda de setembro',
      category_id: 'casa',
      data: '2026-09-30',
    }),
  ]
})

afterEach(() => vi.useRealTimers())

const newButton = () => screen.getAllByRole('button', { name: 'Nova transação' })[0]

describe('página de transações', () => {
  it('mostra as transações do mês atual agrupadas por dia, com sinal e moeda', async () => {
    renderApp('/transacoes')
    const dia14 = await screen.findByRole('region', { name: /14 de outubro/ })
    const supermercado = within(dia14).getByRole('button', { name: /Supermercado/ })
    expect(plain(supermercado.textContent)).toContain('-R$ 123,45')
    expect(supermercado).toHaveTextContent('Alimentação · Conta principal')
    // Nome acessível completo e pontuado (o que um leitor de ecrã anuncia)
    expect(supermercado).toHaveAccessibleName(
      // \s aceita o espaço não separável que o Intl põe depois de "R$"
      /^Supermercado: despesa de R\$\s123,45, Alimentação · Conta principal\. Editar$/,
    )

    const dia5 = screen.getByRole('region', { name: /5 de outubro/ })
    // Sem descrição, o título é o nome da categoria; receitas levam "+"
    const salario = within(dia5).getByRole('button', { name: /Salário/ })
    expect(plain(salario.textContent)).toContain('+R$ 5.000,00')
    expect(salario).toHaveTextContent('Receita de')

    // Setembro não aparece
    expect(screen.queryByText('Renda de setembro')).not.toBeInTheDocument()
  })

  it('navega para o mês anterior e guarda o mês no endereço', async () => {
    const { router } = renderApp('/transacoes')
    await screen.findByText('Supermercado')
    await userEvent.click(screen.getByRole('button', { name: /Mês anterior/ }))

    expect(await screen.findByText('Renda de setembro')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?mes=2026-09')
    expect(store.months).toContain('2026-09')
    expect(screen.getByRole('button', { name: 'Hoje' })).toBeInTheDocument()
  })

  it('mostra um estado vazio nos meses sem transações', async () => {
    renderApp('/transacoes?mes=2026-01')
    expect(await screen.findByText('Sem transações em janeiro de 2026')).toBeInTheDocument()
  })

  it('regista uma despesa: valor em centavos, data de hoje e conta pré-selecionada', async () => {
    renderApp('/transacoes')
    await screen.findByText('Supermercado')
    await userEvent.click(newButton())
    const dialog = await screen.findByRole('dialog', { name: 'Nova transação' })

    expect(within(dialog).getByLabelText('Data')).toHaveValue('2026-10-14')
    expect(within(dialog).getByLabelText('Conta')).toHaveValue('conta')
    // Categorias: só despesas ativas
    const categoria = within(dialog).getByLabelText('Categoria')
    const opcoes = within(categoria)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(opcoes).toEqual(['Escolha…', 'Alimentação', 'Moradia'])

    await userEvent.type(within(dialog).getByLabelText('Valor'), '1.234,50')
    await userEvent.selectOptions(categoria, 'casa')
    await userEvent.type(within(dialog).getByLabelText('Descrição (opcional)'), 'Renda')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(store.transactions.at(-1)).toMatchObject({
      tipo: 'despesa',
      valor_centavos: 123450,
      data: '2026-10-14',
      category_id: 'casa',
      account_id: 'conta',
      descricao: 'Renda',
    })
    expect(await screen.findByRole('button', { name: /Renda/ })).toBeInTheDocument()
  })

  it('cartões de crédito não aparecem na escolha de conta nem são pré-selecionados', async () => {
    // O cartão vem primeiro na lista: se não fosse excluído, seria o pré-selecionado
    store.accounts.unshift({
      ...store.accounts[0],
      id: 'cartao',
      nome: 'A Visa',
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 500000,
      conta_pagamento_id: 'conta',
    })
    renderApp('/transacoes')
    await screen.findByText('Supermercado')
    await userEvent.click(newButton())
    const dialog = await screen.findByRole('dialog', { name: 'Nova transação' })
    const conta = within(dialog).getByLabelText('Conta')
    expect(conta).toHaveValue('conta')
    expect(within(conta).queryByRole('option', { name: 'A Visa' })).not.toBeInTheDocument()
  })

  it('ao mudar para receita, mostra só categorias de receita e limpa a escolha anterior', async () => {
    renderApp('/transacoes')
    await screen.findByText('Supermercado')
    await userEvent.click(newButton())
    const dialog = await screen.findByRole('dialog')
    const categoria = within(dialog).getByLabelText('Categoria')
    await userEvent.selectOptions(categoria, 'alim')

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Receita' }))
    expect(categoria).toHaveValue('')
    expect(
      within(categoria)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Escolha…', 'Salário'])
  })

  it('pré-seleciona a conta mesmo que as contas cheguem depois de abrir o diálogo', async () => {
    const accountsApi = await import('@/features/accounts/accounts-api')
    let release!: () => void
    vi.mocked(accountsApi.listAccounts).mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(store.accounts))),
    )
    renderApp('/transacoes')
    // O botão flutuante (telemóvel) está disponível antes de as contas carregarem
    await userEvent.click(screen.getAllByRole('button', { name: 'Nova transação' })[1])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Conta')).toHaveValue('')

    release()
    await waitFor(() => expect(within(dialog).getByLabelText('Conta')).toHaveValue('conta'))
  })

  it('valida antes de enviar', async () => {
    const api = await import('./transactions-api')
    renderApp('/transacoes')
    await screen.findByText('Supermercado')
    await userEvent.click(newButton())
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))

    expect(within(dialog).getByText('Informe o valor.')).toBeInTheDocument()
    expect(within(dialog).getByText('Escolha uma categoria.')).toBeInTheDocument()
    expect(api.createTransaction).not.toHaveBeenCalled()
  })

  it('edita uma transação existente com os valores preenchidos', async () => {
    renderApp('/transacoes')
    await userEvent.click(await screen.findByRole('button', { name: /Supermercado/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar transação' })
    const valor = within(dialog).getByLabelText('Valor')
    expect(valor).toHaveValue('123,45')
    expect(within(dialog).getByLabelText('Categoria')).toHaveValue('alim')

    await userEvent.clear(valor)
    await userEvent.type(valor, '99')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(store.transactions.find((t) => t.id === 't1')?.valor_centavos).toBe(9900),
    )
  })

  it('uma categoria arquivada continua visível ao editar transações antigas que a usam', async () => {
    store.transactions = [transaction({ id: 'tx', category_id: 'velha', descricao: 'Antiga' })]
    renderApp('/transacoes')
    await userEvent.click(await screen.findByRole('button', { name: /Antiga/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Categoria')).toHaveValue('velha')
    expect(within(dialog).getByRole('option', { name: 'Antiga (arquivada)' })).toBeInTheDocument()
  })

  it('apaga depois de confirmar', async () => {
    renderApp('/transacoes')
    await userEvent.click(await screen.findByRole('button', { name: /Supermercado/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Excluir “Supermercado”?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(screen.queryByText('Supermercado')).not.toBeInTheDocument())
    expect(store.transactions.map((t) => t.id)).not.toContain('t1')
  })

  it('tem um atalho para os lançamentos recorrentes', async () => {
    const { router } = renderApp('/transacoes')
    await userEvent.click(screen.getByRole('link', { name: 'Recorrentes' }))
    expect(router.state.location.pathname).toBe('/configuracoes/recorrentes')
  })

  it('um lançamento criado por uma recorrência mostra "Recorrente" e continua editável', async () => {
    store.transactions.push(
      transaction({ id: 'rec', descricao: 'Netflix', data: '2026-10-10', recorrencia_id: 'r1' }),
    )
    renderApp('/transacoes')
    const row = await screen.findByRole('button', { name: /^Netflix: despesa/ })
    expect(plain(row.textContent)).toContain('Recorrente · Alimentação · Conta principal')
    expect(row).toHaveAccessibleName(/\. Editar$/)
  })
})
