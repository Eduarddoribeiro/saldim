// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import type { Transaction } from '@/features/transactions/transactions-api'
import { renderApp } from '@/test/render-app'

const store = vi.hoisted(() => ({
  transactions: [] as Transaction[],
  categories: [] as Category[],
  accounts: [] as Account[],
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana Silva', moeda: 'BRL', created_at: '' })),
}))
vi.mock('@/features/categories/categories-api', () => ({
  listCategories: vi.fn(async () => store.categories),
}))
vi.mock('@/features/accounts/accounts-api', () => ({
  listAccounts: vi.fn(async () => store.accounts),
}))
vi.mock('@/features/transactions/transactions-api', () => ({
  listTransactions: vi.fn(async (month: string) =>
    store.transactions
      .filter((t) => t.data.startsWith(month))
      .sort((a, b) => b.data.localeCompare(a.data)),
  ),
  listBalanceMovements: vi.fn(async () => store.transactions),
}))
// O Recharts precisa de um browser real para medir o espaço (testado nos E2E). Aqui o módulo dos
// gráficos é substituído por um marcador; os números verificam-se nas tabelas alternativas.
vi.mock('./charts', () => ({
  MonthlyBarsChart: ({ data }: { data: unknown[] }) => <p>barras: {data.length} meses</p>,
  BalanceLineChart: ({ data }: { data: unknown[] }) => <p>linha: {data.length} meses</p>,
}))

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

const account = (id: string, nome: string, saldo: number, arquivada = false): Account => ({
  id,
  nome,
  tipo: 'corrente',
  saldo_inicial_centavos: saldo,
  arquivada,
  user_id: 'u',
  created_at: '',
  dia_fechamento: null,
  dia_vencimento: null,
  limite_centavos: null,
  conta_pagamento_id: null,
})

let counter = 0
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: `t${counter++}`,
  user_id: 'u',
  account_id: 'banco',
  category_id: 'alim',
  tipo: 'despesa',
  valor_centavos: 1000,
  data: '2026-10-10',
  descricao: '',
  created_at: '',
  ...overrides,
})

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')
const tile = (label: RegExp) => plain(screen.getByText(label).closest('div')?.textContent)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 14, 12, 0))
  store.categories = [
    category('alim', 'Alimentação', 'despesa'),
    category('casa', 'Moradia', 'despesa'),
    category('sal', 'Salário', 'receita'),
  ]
  store.accounts = [account('banco', 'Banco', 100000), account('velha', 'Conta antiga', 5000, true)]
  store.transactions = [
    tx({ tipo: 'receita', category_id: 'sal', valor_centavos: 500000, data: '2026-10-05' }),
    tx({ category_id: 'casa', valor_centavos: 150000, data: '2026-10-06', descricao: 'Renda' }),
    tx({ category_id: 'alim', valor_centavos: 50000, data: '2026-10-12', descricao: 'Mercado' }),
    tx({ category_id: 'alim', valor_centavos: 20000, data: '2026-10-20', descricao: 'Futura' }), // depois de hoje
    tx({ category_id: 'casa', valor_centavos: 99900, data: '2026-09-30', descricao: 'Setembro' }),
  ]
})

afterEach(() => vi.useRealTimers())

describe('início (dashboard)', () => {
  it('cumprimenta pelo primeiro nome', async () => {
    renderApp('/')
    expect(await screen.findByText(/Olá, Ana\./)).toBeInTheDocument()
  })

  it('saldo atual = saldos iniciais (todas as contas) + movimentos até hoje; mostra o previsto', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    // 1000,00 + 50,00 (arquivada) + 5000 − 1500 − 500 − 999 (setembro) = 3051,00 ; futura −200 → 2851,00
    expect(tile(/^Saldo atual$/)).toContain('R$ 3.051,00')
    expect(tile(/^Saldo atual$/)).toContain('Previsto com transações futuras: R$ 2.851,00')
  })

  it('receitas, despesas e resultado do mês (inclui transações futuras do próprio mês)', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    expect(tile(/^Receitas · este mês$/)).toContain('R$ 5.000,00')
    expect(tile(/^Despesas · este mês$/)).toContain('R$ 2.200,00')
    expect(tile(/^Resultado · este mês$/)).toContain('+R$ 2.800,00')
    expect(tile(/^Resultado · este mês$/)).toContain('Ganhaste mais do que gastaste.')
  })

  it('gastos por categoria ordenados, com valor e percentagem escritos', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Gastos por categoria' })
    const linhas = within(painel)
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(linhas).toEqual([
      // Setembro: Moradia 999,00 → +501,00 (+50 %); Alimentação sem gastos em setembro
      'MoradiaR$ 1.500,0068%+R$ 501,00 (+50%) face a setembro',
      'AlimentaçãoR$ 700,0032%+R$ 700,00 face a setembro (sem valor anterior)',
    ])
  })

  it('compara receitas, despesas e resultado com o mês anterior', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    expect(tile(/^Receitas · este mês$/)).toContain(
      '+R$ 5.000,00 face a setembro (sem valor anterior)',
    )
    // 2.200,00 − 999,00 = +1.201,00 (+120 %)
    expect(tile(/^Despesas · este mês$/)).toContain('+R$ 1.201,00 (+120%) face a setembro')
    // +2.800,00 − (−999,00) = +3.799,00; % sobre |−999,00| = +380 %
    expect(tile(/^Resultado · este mês$/)).toContain('+R$ 3.799,00 (+380%) face a setembro')
  })

  it('categorias que deixaram de ter gastos aparecem numa nota (não desaparecem em silêncio)', async () => {
    renderApp('/?mes=2026-11')
    const painel = await screen.findByRole('region', { name: 'Gastos por categoria' })
    expect(within(painel).getByText('Sem despesas em novembro de 2026.')).toBeInTheDocument()
    expect(plain(painel.textContent)).toContain(
      'Sem gastos neste mês, mas com gastos em outubro: Moradia (R$ 1.500,00), Alimentação (R$ 700,00).',
    )
  })

  it('receitas e despesas dos últimos 6 meses: gráfico (carregado à parte) e tabela', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Receitas e despesas' })
    // Espera pelo código do gráfico (carregado à parte); depois, a imagem com descrição
    expect(await within(painel).findByText('barras: 6 meses')).toBeInTheDocument()
    expect(
      within(painel).getByRole('img', {
        name: /receitas e as despesas de maio de 2026 a outubro de 2026/,
      }),
    ).toHaveTextContent('barras: 6 meses')

    const tabela = within(painel).getByRole('table', { hidden: true })
    const linhas = within(tabela)
      .getAllByRole('row', { hidden: true })
      .map((tr) => [...tr.children].map((cell) => plain(cell.textContent)).join(' | '))
    expect(linhas).toEqual([
      'Mês | Receitas | Despesas | Resultado',
      'maio de 2026 | R$ 0,00 | R$ 0,00 | R$ 0,00',
      'junho de 2026 | R$ 0,00 | R$ 0,00 | R$ 0,00',
      'julho de 2026 | R$ 0,00 | R$ 0,00 | R$ 0,00',
      'agosto de 2026 | R$ 0,00 | R$ 0,00 | R$ 0,00',
      'setembro de 2026 | R$ 0,00 | R$ 999,00 | -R$ 999,00',
      'outubro de 2026 | R$ 5.000,00 | R$ 2.200,00 | +R$ 2.800,00',
    ])
  })

  it('evolução do saldo: fim de cada mês, mês atual até hoje (= saldo atual)', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Evolução do saldo' })
    // Espera pelo código do gráfico (carregado à parte) e confirma a descrição da imagem
    expect(await within(painel).findByText('linha: 6 meses')).toBeInTheDocument()
    expect(
      within(painel).getByRole('img', { name: /saldo total no fim de cada mês/ }),
    ).toHaveTextContent('linha: 6 meses')
    const linhas = within(within(painel).getByRole('table', { hidden: true }))
      .getAllByRole('row', { hidden: true })
      .slice(-3)
      .map((tr) => [...tr.children].map((cell) => plain(cell.textContent)).join(' | '))
    expect(linhas).toEqual([
      'agosto de 2026 | R$ 1.050,00', // só os saldos iniciais (incluindo a conta arquivada)
      'setembro de 2026 | R$ 51,00',
      'outubro de 2026 (até hoje) | R$ 3.051,00',
    ])
    expect(within(painel).queryByText('Previsto')).not.toBeInTheDocument()
  })

  it('num mês futuro, o saldo é uma previsão (com as transações agendadas)', async () => {
    renderApp('/?mes=2026-11')
    const painel = await screen.findByRole('region', { name: 'Evolução do saldo' })
    expect(within(painel).getByText('Previsto')).toBeInTheDocument()
    const ultima = within(within(painel).getByRole('table', { hidden: true }))
      .getAllByRole('row', { hidden: true })
      .at(-1)!
    expect(plain(ultima.textContent)).toBe('novembro de 2026 (previsto)R$ 2.851,00')
  })

  it('sem movimentos nos 6 meses: mensagem em vez de um gráfico vazio', async () => {
    renderApp('/?mes=2025-01')
    const painel = await screen.findByRole('region', { name: 'Receitas e despesas' })
    expect(painel).toHaveTextContent(
      'Sem receitas nem despesas de agosto de 2024 a janeiro de 2025.',
    )
    expect(within(painel).queryByRole('img')).not.toBeInTheDocument()
  })

  it('sem contas: a evolução do saldo explica porque não há gráfico', async () => {
    store.accounts = []
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Evolução do saldo' })
    expect(painel).toHaveTextContent('Sem contas para mostrar o saldo.')
  })

  it('últimas transações do mês, mais recentes primeiro, com ligação para a lista do mês', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Últimas transações' })
    const titulos = within(painel)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.font-medium')?.textContent)
    expect(titulos).toEqual(['Futura', 'Mercado', 'Renda', 'Salário'])
    expect(within(painel).getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/transacoes',
    )
  })

  it('saldo por conta, incluindo contas arquivadas com dinheiro', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Contas' })
    const linhas = within(painel)
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(linhas).toEqual([
      'BancoConta correnteR$ 3.001,00',
      'Conta antigaConta corrente · arquivadaR$ 50,00',
    ])
  })

  it('noutro mês, os números e as ligações seguem o mês escolhido', async () => {
    renderApp('/?mes=2026-09')
    await screen.findByText('Saldo atual')
    expect(tile(/^Despesas · setembro de 2026$/)).toContain('R$ 999,00')
    expect(tile(/^Resultado · setembro de 2026$/)).toContain('-R$ 999,00')
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/transacoes?mes=2026-09',
    )
    // O saldo atual não depende do mês escolhido
    expect(tile(/^Saldo atual$/)).toContain('R$ 3.051,00')
  })

  it('mês sem movimentos mostra zeros e mensagens claras', async () => {
    renderApp('/?mes=2026-01')
    await screen.findByText('Saldo atual')
    expect(tile(/^Resultado · janeiro de 2026$/)).toContain('R$ 0,00')
    expect(screen.getByText('Sem despesas em janeiro de 2026.')).toBeInTheDocument()
    expect(screen.getByText(/Sem transações em janeiro de 2026\./)).toBeInTheDocument()
  })

  it('o seletor de mês muda os números', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    await userEvent.click(screen.getByRole('button', { name: /Mês anterior/ }))
    expect(await screen.findByText('Despesas · setembro de 2026')).toBeInTheDocument()
  })
})
