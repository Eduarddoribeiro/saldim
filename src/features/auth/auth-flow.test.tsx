// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { routes } from '@/routes'
import { fakeAuth, renderApp, testQueryClient } from '@/test/render-app'
import { AuthContext } from './auth-context'

const noSession = () => fakeAuth({ session: null })

describe('rotas protegidas', () => {
  it('sem sessão, uma página da app redireciona para o login', () => {
    const { router } = renderApp('/transacoes', noSession())
    expect(router.state.location.pathname).toBe('/entrar')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument()
  })

  it('enquanto verifica a sessão mostra "Carregando…" em vez do login', () => {
    renderApp('/', fakeAuth({ session: null, loading: true }))
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(screen.queryByRole('heading', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('com sessão, o login redireciona para a página que a pessoa tinha pedido', () => {
    const router = createMemoryRouter(routes, {
      initialEntries: [{ pathname: '/entrar', state: { from: { pathname: '/transacoes' } } }],
    })
    render(
      <ThemeProvider>
        <QueryClientProvider client={testQueryClient()}>
          <AuthContext value={fakeAuth()}>
            <RouterProvider router={router} />
          </AuthContext>
        </QueryClientProvider>
      </ThemeProvider>,
    )
    expect(router.state.location.pathname).toBe('/transacoes')
  })

  it('ao sair dentro da app, o login não guarda a página onde se estava', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/configuracoes'] })
    // Como em main.tsx: o AppShell usa o TanStack Query (lançamentos recorrentes)
    const queryClient = testQueryClient()
    const app = (auth: ReturnType<typeof fakeAuth>) => (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContext value={auth}>
            <RouterProvider router={router} />
          </AuthContext>
        </QueryClientProvider>
      </ThemeProvider>
    )
    const { rerender } = render(app(fakeAuth()))
    rerender(app(fakeAuth({ session: null }))) // a sessão termina (ex.: botão Sair)

    expect(router.state.location.pathname).toBe('/entrar')
    expect(router.state.location.state).toBeFalsy()
  })

  it('com sessão, /cadastro leva para o início', () => {
    const { router } = renderApp('/cadastro')
    expect(router.state.location.pathname).toBe('/')
  })

  it('o endereço antigo /registar leva para /cadastro', () => {
    const { router } = renderApp('/registar', noSession())
    expect(router.state.location.pathname).toBe('/cadastro')
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('valida os campos antes de contactar o servidor', async () => {
    const auth = noSession()
    renderApp('/entrar', auth)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('envia e-mail (sem espaços) e senha', async () => {
    const auth = noSession()
    renderApp('/entrar', auth)
    await userEvent.type(screen.getByLabelText('E-mail'), '  ana@exemplo.pt ')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(auth.signIn).toHaveBeenCalledWith('ana@exemplo.pt', 'segredo123')
  })

  it('mostra o erro devolvido pelo servidor', async () => {
    const auth = fakeAuth({
      session: null,
      signIn: vi.fn(async () => ({ error: 'E-mail ou senha incorretos.' })),
    })
    renderApp('/entrar', auth)
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.pt')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })
})

describe('registro', () => {
  async function fillSignUp(confirm = 'segredo123') {
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.pt')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.type(screen.getByLabelText('Confirmar senha'), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
  }

  it('não envia se as senhas não coincidem', async () => {
    const auth = noSession()
    renderApp('/cadastro', auth)
    await fillSignUp('outra-senha')
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('envia nome, e-mail e senha', async () => {
    const auth = noSession()
    renderApp('/cadastro', auth)
    await fillSignUp()
    expect(auth.signUp).toHaveBeenCalledWith('Ana', 'ana@exemplo.pt', 'segredo123')
  })

  it('pede para confirmar o e-mail quando o servidor o exige', async () => {
    const auth = fakeAuth({
      session: null,
      signUp: vi.fn(async () => ({ error: null, needsConfirmation: true })),
    })
    renderApp('/cadastro', auth)
    await fillSignUp()
    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument()
  })
})

describe('recuperação de senha', () => {
  it('mostra a mesma confirmação exista ou não a conta', async () => {
    const auth = noSession()
    renderApp('/recuperar-senha', auth)
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@exemplo.pt')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(auth.requestPasswordReset).toHaveBeenCalledWith('ana@exemplo.pt')
    expect(await screen.findByRole('status')).toHaveTextContent('Se existir uma conta')
  })

  it('sem sessão de recuperação, /nova-senha diz que o link é inválido', () => {
    renderApp('/nova-senha', noSession())
    expect(screen.getByRole('heading', { name: 'Link inválido' })).toBeInTheDocument()
  })

  it('com a sessão do link, guarda a nova senha e entra na app', async () => {
    const { router, auth } = renderApp('/nova-senha')
    await userEvent.type(screen.getByLabelText('Nova senha'), 'novasenha1')
    await userEvent.type(screen.getByLabelText('Confirmar nova senha'), 'novasenha1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(auth.updatePassword).toHaveBeenCalledWith('novasenha1')
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('sair', () => {
  it('o botão Sair das configurações termina a sessão', async () => {
    const { auth } = renderApp('/configuracoes')
    expect(screen.getByText(/Conectado como ana@exemplo.pt/)).toBeInTheDocument()
    // Há um botão na sidebar e outro nas configurações; usamos o das configurações (o último)
    const buttons = screen.getAllByRole('button', { name: 'Sair' })
    await userEvent.click(buttons[buttons.length - 1])
    expect(auth.signOut).toHaveBeenCalledOnce()
  })
})
