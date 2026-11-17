// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('AppShell', () => {
  it('mostra a navegação: cinco secções no desktop, quatro + o lançamento no telemóvel', () => {
    renderApp()
    // Há duas navegações (sidebar e barra inferior); o CSS decide qual se vê
    const [sidebarNav, bottomNav] = screen.getAllByRole('navigation', {
      name: 'Navegação principal',
    })
    expect(
      within(sidebarNav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Início', 'Extrato', 'Cartões', 'Orçamentos', 'Configurações'])
    // No telemóvel, Orçamentos e A receber ficam em "Mais" (Configurações)
    expect(
      within(bottomNav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Início', 'Extrato', 'Cartões', 'Mais'])
    expect(within(bottomNav).getByRole('link', { name: 'Mais' })).toHaveAttribute(
      'href',
      '/configuracoes',
    )
    expect(within(bottomNav).getByRole('button', { name: 'Novo lançamento' })).toBeInTheDocument()
  })

  it('o + abre o lançamento rápido a partir de qualquer página', async () => {
    renderApp('/configuracoes')
    const [, bottomNav] = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    await userEvent.click(within(bottomNav).getByRole('button', { name: 'Novo lançamento' }))
    expect(await screen.findByRole('dialog', { name: 'Novo lançamento' })).toBeInTheDocument()
  })

  it('Mais (Configurações) leva a Orçamentos e A receber', () => {
    renderApp('/configuracoes')
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'Orçamentos' })).toHaveAttribute('href', '/orcamentos')
    expect(main.getByRole('link', { name: 'Pessoas e a receber' })).toHaveAttribute(
      'href',
      '/a-receber',
    )
  })

  it('navega entre páginas e marca o link ativo', async () => {
    const { router } = renderApp()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Início')

    const [sidebarNav] = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    await userEvent.click(within(sidebarNav).getByRole('link', { name: 'Extrato' }))

    expect(router.state.location.pathname).toBe('/transacoes')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Extrato')
    expect(within(sidebarNav).getByRole('link', { name: 'Extrato' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(sidebarNav).getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('mostra "Página não encontrada" para endereços desconhecidos', () => {
    renderApp('/nao-existe')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Página não encontrada')
  })

  it('alterna o tema, aplica a classe "dark" e guarda a escolha', async () => {
    renderApp('/configuracoes')
    const html = document.documentElement

    // Sem escolha guardada: segue o sistema (jsdom não tem preferência → claro)
    const [toggle] = screen.getAllByRole('button', { name: /Tema: Sistema/ })
    await userEvent.click(toggle) // Sistema → Claro
    expect(html).not.toHaveClass('dark')

    const [toLight] = screen.getAllByRole('button', { name: /Tema: Claro/ })
    await userEvent.click(toLight) // Claro → Escuro
    expect(html).toHaveClass('dark')
    expect(localStorage.getItem('financas-theme')).toBe('dark')
  })
})

describe('guarda de rede dos testes', () => {
  it('pedidos do Supabase sem mock são intercetados (nunca saem para a rede)', async () => {
    const { realFetchCalls } = await import('@/test/setup')
    renderApp('/')
    // O cliente Supabase tenta de novo após falhas de rede; basta ver que os pedidos foram intercetados
    await waitFor(() =>
      expect(realFetchCalls.some((url) => url.startsWith('http://127.0.0.1:54321/rest/v1/'))).toBe(
        true,
      ),
    )
  })
})
