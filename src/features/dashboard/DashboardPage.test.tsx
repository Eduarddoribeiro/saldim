// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import type { Invoice } from '@/features/invoices/invoices-api'
import type { Person, Reimbursement } from '@/features/people/people-api'
import type { Transaction } from '@/features/transactions/transactions-api'
import type { Transfer } from '@/lib/finance'
import { renderApp } from '@/test/render-app'

const store = vi.hoisted(() => ({
  transactions: [] as Transaction[],
  categories: [] as Category[],
  accounts: [] as Account[],
  transfers: [] as Transfer[],
  people: [] as Person[],
  reimbursements: [] as Reimbursement[],
  invoices: [] as Invoice[],
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
vi.mock('@/features/card-purchases/purchases-api', () => ({
  listPurchases: vi.fn(async () => [
    {
      id: 'c',
      user_id: 'u',
      account_id: 'visa',
      category_id: 'alim',
      descricao: '',
      data_compra: '2026-10-08',
      valor_total_centavos: 30000,
      parcelas: 3,
      parcela_inicial: 1,
      pessoa_id: null,
      created_at: '',
    },
  ]),
}))
vi.mock('@/features/transfers/transfers-api', () => ({
  listTransfers: vi.fn(async () => store.transfers),
}))
vi.mock('@/features/people/people-api', () => ({
  listPeople: vi.fn(async () => store.people),
  listReimbursements: vi.fn(async () => store.reimbursements),
}))
vi.mock('@/features/invoices/invoices-api', () => ({
  listInvoices: vi.fn(async () => store.invoices),
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

const visa = (): Account => ({
  ...account('visa', 'Visa', 0),
  tipo: 'cartao_credito',
  dia_fechamento: 25,
  dia_vencimento: 5,
  limite_centavos: 500000,
  conta_pagamento_id: 'banco',
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
  fatura_id: null,
  compra_id: null,
  parcela_numero: null,
  recorrencia_id: null,
  pessoa_id: null,
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
  store.transfers = []
  store.people = []
  store.reimbursements = []
  store.invoices = []
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

  it('pagamento de fatura: o banco desce, o cartão sobe, o saldo líquido e as despesas não mudam', async () => {
    store.accounts.push(visa())
    // Parcela de 300,00 no cartão (despesa de outubro) e o pagamento dela a 13/10
    store.transactions.push(
      tx({ account_id: 'visa', valor_centavos: 30000, data: '2026-10-08', compra_id: 'c' }),
    )
    store.transfers = [
      {
        conta_origem_id: 'banco',
        conta_destino_id: 'visa',
        valor_centavos: 30000,
        data: '2026-10-13',
      },
    ]
    renderApp('/')
    await screen.findByText('Dinheiro disponível')
    // 3051,00 − 300,00 (a parcela é uma despesa); o pagamento não muda o total
    expect(tile(/^Saldo líquido$/)).toContain('R$ 2.751,00')
    // O cartão está pago: o dinheiro disponível é o líquido e a dívida é zero
    expect(tile(/^Dinheiro disponível$/)).toContain('R$ 2.751,00')
    expect(tile(/^Dívida nos cartões$/)).toContain('R$ 0,00')
    // Despesas do mês: 2200,00 + 300,00 da parcela — o pagamento NÃO conta como despesa
    expect(tile(/^Despesas · este mês$/)).toContain('R$ 2.500,00')
    const contas = screen.getByRole('region', { name: 'Contas' })
    // Banco: 1000 + 5000 − 1500 − 500 − 999 − 300 (pagamento) = 2701,00; Visa: −300 + 300 = 0
    expect(plain(within(contas).getByText('Banco').closest('li')?.textContent)).toContain(
      'R$ 2.701,00',
    )
    expect(plain(within(contas).getByText('Visa').closest('li')?.textContent)).toBe(
      'VisaCartão de créditoLimite disponível: R$ 5.000,00R$ 0,00',
    )
  })

  it('com cartões (D4a): dinheiro disponível em destaque, dívida até hoje e saldo líquido', async () => {
    store.accounts.push(visa())
    // Compra de 300,00 em 3×: a 1.ª parcela já passou, as outras duas são futuras
    store.transactions.push(
      tx({
        account_id: 'visa',
        valor_centavos: 10000,
        data: '2026-10-08',
        compra_id: 'c',
        parcela_numero: 1,
        recorrencia_id: null,
        pessoa_id: null,
        descricao: 'Televisão',
      }),
      tx({ account_id: 'visa', valor_centavos: 10000, data: '2026-11-08', compra_id: 'c' }),
      tx({ account_id: 'visa', valor_centavos: 10000, data: '2026-12-08', compra_id: 'c' }),
    )
    renderApp('/')
    await screen.findByText('Dinheiro disponível')
    expect(screen.queryByText('Saldo atual')).not.toBeInTheDocument()
    // Só as contas de dinheiro: 3051,00 (a futura de 200,00 fica no previsto)
    expect(tile(/^Dinheiro disponível$/)).toContain('R$ 3.051,00')
    expect(tile(/^Dinheiro disponível$/)).toContain('Previsto com transações futuras: R$ 2.851,00')
    // Dívida: só a parcela até hoje (D1a); as futuras aparecem à parte
    expect(tile(/^Dívida nos cartões$/)).toContain('R$ 100,00')
    expect(tile(/^Dívida nos cartões$/)).toContain('Com as parcelas futuras: R$ 300,00')
    // Líquido = 3051,00 − 100,00; previsto = 2851,00 − 300,00
    expect(tile(/^Saldo líquido$/)).toContain('R$ 2.951,00')
    expect(tile(/^Saldo líquido$/)).toContain('Previsto: R$ 2.551,00')
    // A parcela nas últimas transações mostra o total de parcelas da compra
    expect(
      within(screen.getByRole('region', { name: 'Últimas transações' })).getByText(/Parcela 1\/3/),
    ).toBeInTheDocument()
    // O limite já desconta a compra inteira (5000,00 − 300,00)
    const contas = screen.getByRole('region', { name: 'Contas' })
    expect(plain(within(contas).getByText('Visa').closest('li')?.textContent)).toBe(
      'VisaCartão de créditoLimite disponível: R$ 4.700,00-R$ 100,00',
    )
  })

  it('compras da mãe (T1): fora das despesas, na dívida, e o que ela deve soma ao líquido', async () => {
    store.accounts.push(visa())
    store.people = [
      {
        id: 'mae',
        user_id: 'u',
        nome: 'Mãe',
        arquivada: false,
        divida_anterior_centavos: 0,
        created_at: '',
      },
    ]
    const invoice = (id: string, vencimento: string): Invoice => ({
      id,
      account_id: 'visa',
      mes_referencia: `${vencimento.slice(0, 7)}-01`,
      data_fechamento: vencimento,
      data_vencimento: vencimento,
    })
    store.invoices = [
      invoice('f1', '2026-10-10'),
      invoice('f2', '2026-11-10'),
      invoice('f3', '2026-12-10'),
    ]
    // A mãe comprou 300,00 em 3× no Visa; a fatura da 1.ª parcela já venceu
    const daMae = { account_id: 'visa', compra_id: 'c', pessoa_id: 'mae', valor_centavos: 10000 }
    store.transactions.push(
      tx({ ...daMae, data: '2026-10-08', fatura_id: 'f1', parcela_numero: 1, descricao: 'Sofá' }),
      tx({ ...daMae, data: '2026-11-08', fatura_id: 'f2', parcela_numero: 2 }),
      tx({ ...daMae, data: '2026-12-08', fatura_id: 'f3', parcela_numero: 3 }),
    )
    // Devolveu 50,00 para o banco
    store.reimbursements = [
      {
        id: 'r1',
        user_id: 'u',
        pessoa_id: 'mae',
        account_id: 'banco',
        valor_centavos: 5000,
        data: '2026-10-12',
        descricao: '',
        created_at: '',
      },
    ]
    renderApp('/')
    await screen.findByText('A receber')
    // As despesas do mês não incluem a parcela da mãe (as mesmas 2200,00 de sempre)
    expect(tile(/^Despesas · este mês$/)).toContain('R$ 2.200,00')
    // O reembolso entra no banco: 3051,00 + 50,00
    expect(tile(/^Dinheiro disponível$/)).toContain('R$ 3.101,00')
    // A dívida do cartão inclui a parcela da mãe (é dívida real)
    expect(tile(/^Dívida nos cartões$/)).toContain('R$ 100,00')
    // Deve 300,00 − 50,00; já vencido 100,00 − 50,00
    expect(tile(/^A receber$/)).toContain('R$ 250,00')
    expect(tile(/^A receber$/)).toContain('Mãe: R$ 250,00')
    expect(tile(/^A receber$/)).toContain('Já vencido: R$ 50,00')
    // Líquido = 3101,00 − 100,00 + 250,00 (D20)
    expect(tile(/^Saldo líquido$/)).toContain('R$ 3.251,00')
    expect(
      within(screen.getByRole('region', { name: 'Últimas transações' })).getByText(
        /Para Mãe · Parcela 1\/3/,
      ),
    ).toBeInTheDocument()
  })

  it('pagar a mais dá crédito nos cartões, que soma ao limite disponível', async () => {
    store.accounts.push({ ...visa(), limite_centavos: 20000 })
    store.transactions.push(
      tx({ account_id: 'visa', valor_centavos: 30000, data: '2026-10-08', compra_id: 'c' }),
    )
    store.transfers = [
      {
        conta_origem_id: 'banco',
        conta_destino_id: 'visa',
        valor_centavos: 35000,
        data: '2026-10-13',
      },
    ]
    renderApp('/')
    // Pagou 350,00 de 300,00: 50,00 de crédito, e o limite fica 200,00 + 50,00
    await screen.findByText('Crédito nos cartões')
    expect(tile(/^Crédito nos cartões$/)).toContain('R$ 50,00')
    const contas = screen.getByRole('region', { name: 'Contas' })
    expect(plain(within(contas).getByText('Visa').closest('li')?.textContent)).toContain(
      'Limite disponível: R$ 250,00',
    )
  })

  it('compras acima do limite: mostra quanto passou (o limite não bloqueia compras)', async () => {
    store.accounts.push({ ...visa(), limite_centavos: 20000 })
    store.transactions.push(
      tx({ account_id: 'visa', valor_centavos: 30000, data: '2026-10-08', compra_id: 'c' }),
    )
    renderApp('/')
    const contas = await screen.findByRole('region', { name: 'Contas' })
    expect(plain(within(contas).getByText('Visa').closest('li')?.textContent)).toContain(
      'Limite ultrapassado em R$ 100,00',
    )
  })

  it('receitas, despesas e resultado do mês (inclui transações futuras do próprio mês)', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    expect(tile(/^Receitas · este mês$/)).toContain('R$ 5.000,00')
    expect(tile(/^Despesas · este mês$/)).toContain('R$ 2.200,00')
    expect(tile(/^Resultado · este mês$/)).toContain('+R$ 2.800,00')
    expect(tile(/^Resultado · este mês$/)).toContain('Você ganhou mais do que gastou.')
  })

  it('gastos por categoria ordenados, com valor e percentagem escritos', async () => {
    renderApp('/')
    const painel = await screen.findByRole('region', { name: 'Gastos por categoria' })
    const linhas = within(painel)
      .getAllByRole('listitem')
      .map((li) => plain(li.textContent))
    expect(linhas).toEqual([
      // Setembro: Moradia 999,00 → +501,00 (+50 %); Alimentação sem gastos em setembro
      'MoradiaR$ 1.500,0068%+R$ 501,00 (+50%) em relação a setembro',
      'AlimentaçãoR$ 700,0032%+R$ 700,00 em relação a setembro (sem valor anterior)',
    ])
  })

  it('compara receitas, despesas e resultado com o mês anterior', async () => {
    renderApp('/')
    await screen.findByText('Saldo atual')
    expect(tile(/^Receitas · este mês$/)).toContain(
      '+R$ 5.000,00 em relação a setembro (sem valor anterior)',
    )
    // 2.200,00 − 999,00 = +1.201,00 (+120 %)
    expect(tile(/^Despesas · este mês$/)).toContain('+R$ 1.201,00 (+120%) em relação a setembro')
    // +2.800,00 − (−999,00) = +3.799,00; % sobre |−999,00| = +380 %
    expect(tile(/^Resultado · este mês$/)).toContain('+R$ 3.799,00 (+380%) em relação a setembro')
  })

  it('categorias que deixaram de ter gastos aparecem em uma nota (não desaparecem em silêncio)', async () => {
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

  it('em um mês futuro, o saldo é uma previsão (com as transações agendadas)', async () => {
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
