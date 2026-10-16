// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { renderApp } from '@/test/render-app'
import { generateRecurring } from './generate-api'
import { createRecurring, updateRecurring, type Recurring } from './recurring-api'

// generate-api é simulado para todos os testes em src/test/setup.ts (devolve 0)

const store = vi.hoisted(() => ({
  recurring: [] as Recurring[],
  categories: [] as Category[],
  accounts: [] as Account[],
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
vi.mock('./recurring-api', () => ({
  listRecurring: vi.fn(async () => store.recurring),
  createRecurring: vi.fn(async () => ({})),
  updateRecurring: vi.fn(async (id: string, patch: Partial<Recurring>) => {
    const item = store.recurring.find((r) => r.id === id)!
    Object.assign(item, patch)
    return item
  }),
  deleteRecurring: vi.fn(async () => {}),
}))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

const category = (id: string, nome: string, tipo: Category['tipo']): Category => ({
  id,
  nome,
  tipo,
  arquivada: false,
  user_id: 'u',
  cor: 'slate',
  icone: 'tag',
  created_at: '',
})

const account = (id: string, nome: string, overrides: Partial<Account> = {}): Account => ({
  id,
  user_id: 'u',
  nome,
  tipo: 'corrente',
  saldo_inicial_centavos: 0,
  arquivada: false,
  created_at: '',
  dia_fechamento: null,
  dia_vencimento: null,
  limite_centavos: null,
  conta_pagamento_id: null,
  ...overrides,
})

const recurring = (overrides: Partial<Recurring>): Recurring => ({
  id: 'r',
  user_id: 'u',
  account_id: 'picpay',
  category_id: 'lazer',
  tipo: 'despesa',
  valor_centavos: 5590,
  descricao: 'Netflix',
  frequencia: 'mensal',
  dia: 20,
  proxima_data: '2026-10-20',
  ativa: true,
  falha: null,
  falha_data: null,
  created_at: '',
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  vi.mocked(createRecurring).mockClear()
  vi.mocked(updateRecurring).mockClear()
  vi.mocked(generateRecurring).mockClear()
  store.categories = [
    category('lazer', 'Lazer', 'despesa'),
    category('casa', 'Moradia', 'despesa'),
    category('sal', 'Salário', 'receita'),
  ]
  store.accounts = [
    account('picpay', 'PicPay'),
    account('nubank', 'Nubank', {
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 500000,
      conta_pagamento_id: 'picpay',
    }),
  ]
  store.recurring = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RecurringGenerator', () => {
  it('ao abrir a app, cria os lançamentos que já chegaram ao dia (data local)', async () => {
    renderApp('/')
    await waitFor(() => expect(generateRecurring).toHaveBeenCalledWith('2026-10-14'))
    expect(generateRecurring).toHaveBeenCalledTimes(1)
  })
})

describe('RecurringPage', () => {
  it('abre a partir das Configurações e mostra o estado vazio', async () => {
    renderApp('/configuracoes')
    await userEvent.click(screen.getByRole('link', { name: 'Recorrentes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Recorrentes' })).toBeInTheDocument()
    expect(await screen.findByText('Ainda sem recorrentes')).toBeInTheDocument()
  })

  it('lista por próxima data, com a repetição, a conta e as pausadas no fim', async () => {
    store.recurring = [
      recurring({ id: 'a', descricao: 'Netflix', proxima_data: '2026-10-20', dia: 20 }),
      recurring({
        id: 'b',
        descricao: 'Renda',
        category_id: 'casa',
        valor_centavos: 150000,
        proxima_data: '2026-10-31',
        dia: 31,
      }),
      recurring({
        id: 'c',
        descricao: 'Ginásio',
        proxima_data: '2026-06-01',
        dia: 1,
        ativa: false,
      }),
      recurring({
        id: 'd',
        descricao: 'Salário',
        tipo: 'receita',
        category_id: 'sal',
        valor_centavos: 500000,
        proxima_data: '2026-11-05',
        dia: 5,
      }),
    ]
    store.recurring.sort((x, y) => x.proxima_data.localeCompare(y.proxima_data))
    renderApp('/configuracoes/recorrentes')
    const list = await screen.findByRole('list', { name: 'Recorrentes' })
    const rows = within(list)
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(rows).toEqual([
      'NetflixTodo dia 20 · PicPayPróximo: 20/10/2026-R$ 55,90',
      'RendaTodo dia 31 (ou o último dia do mês) · PicPayPróximo: 31/10/2026-R$ 1.500,00',
      'SalárioTodo dia 5 · PicPayPróximo: 05/11/2026+R$ 5.000,00',
      'GinásioTodo dia 1 · PicPayPausado-R$ 55,90',
    ])
  })

  it('cria um recorrente no cartão (só despesas) com o dia da data escolhida', async () => {
    renderApp('/configuracoes/recorrentes')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo recorrente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo recorrente' })

    // Numa receita, os cartões não aparecem
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Receita' }))
    const conta = within(dialog).getByLabelText('Conta')
    expect(within(conta).queryByRole('option', { name: 'Nubank' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Despesa' }))

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Spotify')
    await userEvent.type(within(dialog).getByLabelText('Valor'), '21,90')
    await userEvent.selectOptions(within(dialog).getByLabelText('Conta ou cartão'), 'Nubank')
    expect(within(dialog).getByText(/cada lançamento é uma compra à vista/)).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText('Categoria'), 'Lazer')
    const data = within(dialog).getByLabelText('Próxima data')
    await userEvent.clear(data)
    await userEvent.type(data, '2026-10-31')
    expect(
      within(dialog).getByText('Todo dia 31 (ou o último dia do mês), a partir desta data.'),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar' }))

    await waitFor(() =>
      expect(createRecurring).toHaveBeenCalledWith({
        tipo: 'despesa',
        valorCentavos: 2190,
        descricao: 'Spotify',
        accountId: 'nubank',
        categoryId: 'lazer',
        frequencia: 'mensal',
        proximaData: '2026-10-31',
        dia: 31,
      }),
    )
    // Depois de criar, o lançamento de hoje pode já ser devido
    await waitFor(() => expect(generateRecurring).toHaveBeenCalledTimes(2))
  })

  it('anual: descreve o dia e o mês', async () => {
    renderApp('/configuracoes/recorrentes')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo recorrente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo recorrente' })
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Anual' }))
    const data = within(dialog).getByLabelText('Próxima data')
    await userEvent.clear(data)
    await userEvent.type(data, '2027-03-15')
    expect(
      within(dialog).getByText('Todos os anos a 15 de março, a partir desta data.'),
    ).toBeInTheDocument()
  })

  it('recusa uma próxima data no passado e um nome vazio', async () => {
    renderApp('/configuracoes/recorrentes')
    await userEvent.click(await screen.findByRole('button', { name: 'Novo recorrente' }))
    const dialog = await screen.findByRole('dialog', { name: 'Novo recorrente' })
    await userEvent.type(within(dialog).getByLabelText('Valor'), '10')
    const data = within(dialog).getByLabelText('Próxima data')
    await userEvent.clear(data)
    await userEvent.type(data, '2026-10-13')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar' }))
    expect(
      await within(dialog).findByText('A próxima data não pode ser no passado.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Indica um nome (ex.: Netflix).')).toBeInTheDocument()
    expect(createRecurring).not.toHaveBeenCalled()
  })

  it('editar sem mudar a data mantém o dia pedido (31 em novembro continua 31)', async () => {
    store.recurring = [
      recurring({ id: 'renda', descricao: 'Renda', proxima_data: '2026-11-30', dia: 31 }),
    ]
    renderApp('/configuracoes/recorrentes')
    await userEvent.click(await screen.findByRole('button', { name: /^Renda:/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar recorrente' })
    const valor = within(dialog).getByLabelText('Valor')
    await userEvent.clear(valor)
    await userEvent.type(valor, '1600')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(updateRecurring).toHaveBeenCalledWith(
        'renda',
        expect.objectContaining({ valor_centavos: 160000, dia: 31, proxima_data: '2026-11-30' }),
      ),
    )
  })

  it('pausar e retomar: ao retomar recomeça na próxima data a partir de hoje', async () => {
    store.recurring = [
      recurring({
        id: 'gin',
        descricao: 'Ginásio',
        proxima_data: '2026-07-10',
        dia: 10,
        ativa: false,
      }),
    ]
    renderApp('/configuracoes/recorrentes')
    await userEvent.click(await screen.findByRole('button', { name: /^Ginásio:/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar recorrente' })
    expect(within(dialog).getByText(/Está pausado/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retomar' }))
    await waitFor(() =>
      expect(updateRecurring).toHaveBeenCalledWith('gin', {
        ativa: true,
        proxima_data: '2026-11-10',
        dia: 10,
      }),
    )
  })

  it('mostra o aviso de um lançamento que não foi criado e deixa dispensá-lo', async () => {
    store.recurring = [
      recurring({
        id: 'x',
        descricao: 'Netflix',
        falha: 'recorrencias_arquivada_check',
        falha_data: '2026-10-10',
      }),
    ]
    renderApp('/configuracoes/recorrentes')
    const alert = await screen.findByRole('alert')
    expect(plain(alert.textContent)).toContain(
      'Netflix: O lançamento de 10/10/2026 não foi criado: a conta ou a categoria está arquivada.',
    )
    await userEvent.click(within(alert).getByRole('button', { name: 'Dispensar' }))
    await waitFor(() =>
      expect(updateRecurring).toHaveBeenCalledWith('x', { falha: null, falha_data: null }),
    )
  })
})
