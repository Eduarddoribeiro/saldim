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
  it('mostra a navegação com as quatro secções', () => {
    renderApp()
    // Há duas navegações (sidebar e barra inferior); o CSS decide qual se vê
    const navs = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link')
      expect(links.map((link) => link.textContent)).toEqual([
        'Início',
        'Transações',
        'Orçamentos',
        'Configurações',
      ])
    }
  })

  it('navega entre páginas e marca o link ativo', async () => {
    const { router } = renderApp()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Início')

    const [sidebarNav] = screen.getAllByRole('navigation', { name: 'Navegação principal' })
    await userEvent.click(within(sidebarNav).getByRole('link', { name: 'Transações' }))

    expect(router.state.location.pathname).toBe('/transacoes')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Transações')
    expect(within(sidebarNav).getByRole('link', { name: 'Transações' })).toHaveAttribute(
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
