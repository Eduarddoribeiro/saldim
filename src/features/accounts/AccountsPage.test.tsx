// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import type { Account } from './accounts-api'

const store = vi.hoisted(() => ({ accounts: [] as Account[], moeda: 'BRL' }))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: store.moeda, created_at: '' })),
}))

vi.mock('./accounts-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./accounts-api')>()
  return {
    sortAccounts: original.sortAccounts,
    listAccounts: vi.fn(async () => original.sortAccounts(store.accounts)),
    createAccount: vi.fn(
      async (values: { nome: string; tipo: Account['tipo']; saldoInicial: number }) => {
        const created = makeAccount({
          id: `nova-${store.accounts.length}`,
          nome: values.nome,
          tipo: values.tipo,
          saldo_inicial_centavos: values.saldoInicial,
        })
        store.accounts.push(created)
        return created
      },
    ),
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
    ...overrides,
  }
}

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

beforeEach(() => {
  store.moeda = 'BRL'
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

  it('as Configurações têm ligação para as contas', async () => {
    const { router } = renderApp('/configuracoes')
    await userEvent.click(screen.getByRole('link', { name: 'Contas' }))
    expect(router.state.location.pathname).toBe('/configuracoes/contas')
  })
})
