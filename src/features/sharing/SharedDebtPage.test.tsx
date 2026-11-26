// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import type { SharedDebt } from './sharing-api'

const store = vi.hoisted(() => ({ debts: [] as SharedDebt[], movements: [] as unknown[] }))

vi.mock('@/features/profile/profile-api', () => ({
  getProfile: vi.fn(async () => ({ id: 'u', nome: 'Ana', moeda: 'BRL', created_at: '' })),
}))
vi.mock('./sharing-api', () => ({ listSharedDebts: vi.fn(async () => store.debts) }))
vi.mock('@/features/transactions/transactions-api', () => ({
  listBalanceMovements: vi.fn(async () => store.movements),
}))

const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

// Hoje 26/11/2026. Celular 6× de 299,80 (parcelas set-fev); show à vista em outubro (já vencido)
const parcela = (fatura: string, compra: string, valor: number, data: string) => ({
  tipo: 'despesa' as const,
  valor_centavos: valor,
  data,
  account_id: 'itau',
  fatura_id: fatura,
  compra_id: compra,
  pessoa_id: 'ana',
})
const compra = (
  id: string,
  category_id: string,
  descricao: string,
  valor: number,
  parcelas: number,
) => ({
  id,
  account_id: 'itau',
  category_id,
  descricao,
  data_compra: '2026-08-21',
  valor_total_centavos: valor,
  parcelas,
  parcela_inicial: 1,
  pessoa_id: 'ana',
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 26, 12, 0))
  store.movements = []
  store.debts = [
    {
      pessoaId: 'ana',
      pessoaNome: 'Ana',
      donoNome: 'Marina',
      dividaAnterior: 0,
      compras: [
        compra('cel', 'compras', 'Celular', 179880, 6),
        compra('show', 'lazer', 'Show', 32000, 1),
      ],
      movimentos: [
        parcela('nov', 'show', 32000, '2026-10-10'),
        parcela('dez', 'cel', 29980, '2026-11-21'),
        parcela('jan', 'cel', 29980, '2026-12-21'),
      ],
      faturas: [
        { id: 'nov', data_vencimento: '2026-11-07' },
        { id: 'dez', data_vencimento: '2026-12-07' },
        { id: 'jan', data_vencimento: '2027-01-07' },
      ],
      cartoes: [{ id: 'itau', nome: 'Cartão Itaú' }],
      categorias: [
        { id: 'compras', nome: 'Compras', cor: 'pink', icone: 'shopping-bag' },
        { id: 'lazer', nome: 'Lazer', cor: 'violet', icone: 'party-popper' },
      ],
      reembolsos: [],
      donoChavePix: 'marina@email.com',
    },
  ]
})
afterEach(() => vi.useRealTimers())

describe('O que eu devo (app da mãe)', () => {
  it('quem só vê o que deve: abre direto aqui, sem a navegação do app', async () => {
    const { router } = renderApp('/configuracoes')
    const divida = await screen.findByRole('region', { name: 'Você deve a Marina' })
    expect(router.state.location.pathname).toBe('/o-que-devo')
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument()

    // Quanto pagar e até quando: dezembro + o atrasado
    const texto = plain(divida.textContent)
    expect(texto).toContain('Para pagar até 07/12')
    expect(texto).toContain('R$ 619,80')
    expect(texto).toContain('R$ 299,80 deste mês + R$ 320,00 que ficou atrasado')
    expect(texto).toContain('Falta ao todo: R$ 919,60')

    const meses = within(screen.getByRole('list', { name: 'Mês a mês' }))
    expect(meses.getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual([
      'AtrasadoR$ 320,00',
      'DezembroR$ 299,80',
      'Janeiro de 2027R$ 299,80',
    ])
    const onde = within(screen.getByRole('list', { name: 'Onde você gastou' }))
    expect(onde.getAllByRole('listitem').map((li) => plain(li.textContent))).toEqual([
      'ComprasR$ 1.798,80 · 85%Celular',
      'LazerR$ 320,00 · 15%Show',
    ])
  })

  it('copia a chave Pix de quem convidou', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderApp('/o-que-devo')
    await userEvent.click(await screen.findByRole('button', { name: 'Copiar chave Pix de Marina' }))
    expect(writeText).toHaveBeenCalledWith('marina@email.com')
    expect(screen.getByRole('button', { name: 'Chave copiada' })).toBeInTheDocument()
  })

  it('quem também tem lançamentos próprios vê o app completo', async () => {
    store.movements = [
      {
        account_id: 'a',
        category_id: 'c',
        tipo: 'despesa',
        valor_centavos: 100,
        data: '2026-11-01',
      },
    ]
    renderApp('/o-que-devo')
    await screen.findByRole('region', { name: 'Você deve a Marina' })
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0)
  })
})
