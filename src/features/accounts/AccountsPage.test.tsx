// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invoice } from '@/features/invoices/invoices-api'
import { renderApp } from '@/test/render-app'
import type { Account } from './accounts-api'
import type { CardDaysRow } from './card-days-api'

const store = vi.hoisted(() => ({
  accounts: [] as Account[],
  moeda: 'BRL',
  invoices: [] as Invoice[],
  cardDays: [] as CardDaysRow[],
}))

vi.mock('@/features/invoices/invoices-api', () => ({
  listInvoices: vi.fn(async () => store.invoices),
}))
vi.mock('./card-days-api', () => ({
  listCardDaysHistory: vi.fn(async () => store.cardDays),
}))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: store.moeda, created_at: '' })),
}))

vi.mock('./accounts-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./accounts-api')>()
  return {
    sortAccounts: original.sortAccounts,
    accountRow: original.accountRow,
    listAccounts: vi.fn(async () => original.sortAccounts(store.accounts)),
    createAccount: vi.fn(async (values: Parameters<typeof original.accountRow>[0]) => {
      const created = makeAccount({
        id: `nova-${store.accounts.length}`,
        ...original.accountRow(values),
      })
      store.accounts.push(created)
      return created
    }),
    updateAccount: vi.fn(async (id: string, patch: Partial<Account>) => {
      const account = store.accounts.find((a) => a.id === id)!
      Object.assign(account, patch)
      return account
    }),
    deleteAccount: vi.fn(async () => {}),
  }
})

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'id',
    user_id: 'u',
    nome: 'Conta',
    tipo: 'corrente',
    saldo_inicial_centavos: 0,
    arquivada: false,
    created_at: '2026-01-01T00:00:00Z',
    dia_fechamento: null,
    dia_vencimento: null,
    limite_centavos: null,
    conta_pagamento_id: null,
    ...overrides,
  }
}

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  store.moeda = 'BRL'
  store.invoices = []
  store.cardDays = []
  store.accounts = [
    makeAccount({ id: 'a1', nome: 'Conta principal', saldo_inicial_centavos: 123456 }),
    makeAccount({ id: 'a2', nome: 'Carteira', tipo: 'dinheiro', saldo_inicial_centavos: -500 }),
  ]
})

describe('página de contas', () => {
  it('lista as contas com tipo e saldo inicial formatado na moeda do perfil', async () => {
    renderApp('/configuracoes/contas')
    const conta = await screen.findByRole('button', { name: /Conta principal/ })
    expect(conta).toHaveTextContent('Conta corrente')
    await waitFor(() => expect(plain(conta.textContent)).toContain('R$ 1.234,56'))
    expect(plain(screen.getByRole('button', { name: /Carteira/ }).textContent)).toContain(
      '-R$ 5,00',
    )
  })

  it('usa euros quando o perfil está em EUR', async () => {
    store.moeda = 'EUR'
    renderApp('/configuracoes/contas')
    const conta = await screen.findByRole('button', { name: /Conta principal/ })
    await waitFor(() => expect(plain(conta.textContent)).toContain('1234,56 €'))
  })

  it('cria uma conta convertendo o saldo inicial para centavos', async () => {
    renderApp('/configuracoes/contas')
    await screen.findByRole('button', { name: /Carteira/ })
    await userEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nova conta' })

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Poupança')
    await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'poupanca')
    const saldo = within(dialog).getByLabelText('Saldo inicial')
    await userEvent.clear(saldo)
    await userEvent.type(saldo, '2.500,50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(store.accounts.at(-1)).toMatchObject({
      nome: 'Poupança',
      tipo: 'poupanca',
      saldo_inicial_centavos: 250050,
    })
  })

  it('mostra erro claro para um saldo inválido', async () => {
    renderApp('/configuracoes/contas')
    await screen.findByRole('button', { name: /Carteira/ })
    await userEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Teste')
    const saldo = within(dialog).getByLabelText('Saldo inicial')
    await userEvent.clear(saldo)
    await userEvent.type(saldo, '12,345')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))

    expect(within(dialog).getByText(/Valor inválido/)).toBeInTheDocument()
    expect(saldo).toHaveAttribute('aria-invalid', 'true')
  })

  it('ao editar, preenche o saldo no formato do campo e guarda alterações', async () => {
    renderApp('/configuracoes/contas')
    await userEvent.click(await screen.findByRole('button', { name: /Conta principal/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar conta' })
    const saldo = within(dialog).getByLabelText('Saldo inicial')
    expect(saldo).toHaveValue('1234,56')

    await userEvent.clear(saldo)
    await userEvent.type(saldo, '-10')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(store.accounts.find((a) => a.id === 'a1')?.saldo_inicial_centavos).toBe(-1000),
    )
  })

  describe('cartão de crédito', () => {
    const cartao = () =>
      makeAccount({
        id: 'c1',
        nome: 'Visa',
        tipo: 'cartao_credito',
        dia_fechamento: 25,
        dia_vencimento: 5,
        limite_centavos: 500000,
        conta_pagamento_id: 'a1',
      })

    it('os campos do cartão só aparecem para o tipo cartão (e o saldo inicial desaparece)', async () => {
      renderApp('/configuracoes/contas')
      await screen.findByRole('button', { name: /Carteira/ })
      await userEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
      const dialog = await screen.findByRole('dialog', { name: 'Nova conta' })
      expect(within(dialog).getByLabelText('Saldo inicial')).toBeInTheDocument()
      expect(within(dialog).queryByLabelText('Dia de fechamento')).not.toBeInTheDocument()

      await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'cartao_credito')
      expect(within(dialog).queryByLabelText('Saldo inicial')).not.toBeInTheDocument()
      for (const label of ['Dia de fechamento', 'Dia de vencimento', 'Limite de crédito']) {
        expect(within(dialog).getByLabelText(label)).toBeInTheDocument()
      }
      expect(within(dialog).getByLabelText('Conta de pagamento')).toBeInTheDocument()

      await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'poupanca')
      expect(within(dialog).queryByLabelText('Dia de fechamento')).not.toBeInTheDocument()
    })

    it('cria um cartão com fechamento, vencimento, limite e conta de pagamento', async () => {
      renderApp('/configuracoes/contas')
      await screen.findByRole('button', { name: /Carteira/ })
      await userEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
      const dialog = await screen.findByRole('dialog', { name: 'Nova conta' })
      await userEvent.type(within(dialog).getByLabelText('Nome'), 'Visa')
      await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'cartao_credito')
      await userEvent.selectOptions(within(dialog).getByLabelText('Dia de fechamento'), '25')
      await userEvent.selectOptions(within(dialog).getByLabelText('Dia de vencimento'), '5')
      await userEvent.type(within(dialog).getByLabelText('Limite de crédito'), '5.000,00')
      await userEvent.selectOptions(within(dialog).getByLabelText('Conta de pagamento'), 'a1')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(store.accounts.at(-1)).toMatchObject({
        nome: 'Visa',
        tipo: 'cartao_credito',
        saldo_inicial_centavos: 0,
        dia_fechamento: 25,
        dia_vencimento: 5,
        limite_centavos: 500000,
        conta_pagamento_id: 'a1',
      })
    })

    it('mostra os erros dos dias e avisa de prazos pouco habituais', async () => {
      renderApp('/configuracoes/contas')
      await screen.findByRole('button', { name: /Carteira/ })
      await userEvent.click(screen.getByRole('button', { name: 'Nova conta' }))
      const dialog = await screen.findByRole('dialog', { name: 'Nova conta' })
      await userEvent.type(within(dialog).getByLabelText('Nome'), 'Visa')
      await userEvent.selectOptions(within(dialog).getByLabelText('Tipo'), 'cartao_credito')

      // Prazo de 1 dia: válido, mas com aviso
      await userEvent.selectOptions(within(dialog).getByLabelText('Dia de fechamento'), '27')
      await userEvent.selectOptions(within(dialog).getByLabelText('Dia de vencimento'), '28')
      expect(within(dialog).getByRole('status')).toHaveTextContent('é de 1 dia.')

      // Mesmo dia: erro no vencimento, nada é criado
      await userEvent.selectOptions(within(dialog).getByLabelText('Dia de vencimento'), '27')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))
      expect(
        await within(dialog).findByText('O vencimento tem de ser num dia diferente do fechamento.'),
      ).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Dia de vencimento')).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(store.accounts).toHaveLength(2)
    })

    it('a conta de pagamento exclui cartões, contas arquivadas e o próprio cartão', async () => {
      store.accounts.push(
        cartao(),
        { ...cartao(), id: 'c2', nome: 'Master' },
        makeAccount({ id: 'a3', nome: 'Antiga', arquivada: true }),
      )
      renderApp('/configuracoes/contas')
      await userEvent.click(await screen.findByRole('button', { name: /Visa/ }))
      const dialog = await screen.findByRole('dialog', { name: 'Editar conta' })
      const pagamento = within(dialog).getByLabelText('Conta de pagamento')
      expect(pagamento).toHaveValue('a1')
      const options = within(pagamento)
        .getAllByRole('option')
        .map((option) => option.textContent)
      expect(options).toEqual(['Escolhe a conta', 'Carteira', 'Conta principal'])
    })

    describe('mudar os dias de um cartão com faturas (C8)', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 16, 12, 0))
        store.accounts.push(cartao())
        store.invoices = [
          {
            id: 'f',
            account_id: 'c1',
            mes_referencia: '2026-11-01',
            data_fechamento: '2026-10-25',
            data_vencimento: '2026-11-05',
          },
        ]
      })
      afterEach(() => vi.useRealTimers())

      async function editarDias(fechamento: string, vencimento: string) {
        renderApp('/configuracoes/contas')
        await userEvent.click(await screen.findByRole('button', { name: /Visa/ }))
        const dialog = await screen.findByRole('dialog', { name: 'Editar conta' })
        await userEvent.selectOptions(
          within(dialog).getByLabelText('Dia de fechamento'),
          fechamento,
        )
        await userEvent.selectOptions(
          within(dialog).getByLabelText('Dia de vencimento'),
          vencimento,
        )
        return dialog
      }

      it('explica a partir de que fatura valem os dias novos', async () => {
        const dialog = await editarDias('10', '20')
        expect(
          await within(dialog).findByText(
            'Os dias novos valem a partir da fatura de novembro de 2026, que passa a fechar a 10/11/2026 e a vencer a 20/11/2026 (com compras desde 25/09/2026). As faturas já fechadas não mudam.',
          ),
        ).toBeInTheDocument()
      })

      it('avisa quando a fatura aberta fecharia antes de hoje', async () => {
        const dialog = await editarDias('15', '5')
        expect(
          await within(dialog).findByText(
            'Com estes dias, a fatura aberta (novembro de 2026) fecharia a 15/10/2026, que já passou. Escolhe outros dias ou espera que essa fatura feche.',
          ),
        ).toBeInTheDocument()
      })

      it('sem faturas, os dias mudam sem aviso', async () => {
        store.invoices = []
        const dialog = await editarDias('10', '20')
        expect(within(dialog).queryByText(/Os dias novos valem/)).not.toBeInTheDocument()
      })
    })

    it('na lista, o cartão mostra os dias da fatura e o limite', async () => {
      store.accounts.push(cartao())
      renderApp('/configuracoes/contas')
      const visa = await screen.findByRole('button', { name: /Visa/ })
      expect(visa).toHaveTextContent('Cartão de crédito · fecha dia 25 · vence dia 5')
      await waitFor(() => expect(plain(visa.textContent)).toContain('LimiteR$ 5.000,00'))
    })
  })

  it('as Configurações têm ligação para as contas', async () => {
    const { router } = renderApp('/configuracoes')
    await userEvent.click(screen.getByRole('link', { name: 'Contas' }))
    expect(router.state.location.pathname).toBe('/configuracoes/contas')
  })
})
