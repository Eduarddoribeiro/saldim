// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserFacingError } from '@/lib/db-errors'
import { renderApp } from '@/test/render-app'
import type { Category } from './categories-api'

// "Servidor" em memória: substitui o módulo que fala com o Supabase.
const store = vi.hoisted(() => ({ categories: [] as Category[], nextId: 1 }))

vi.mock('./categories-api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./categories-api')>()
  return {
    sortCategories: original.sortCategories,
    listCategories: vi.fn(async () => original.sortCategories(store.categories)),
    createCategory: vi.fn(async (values: Pick<Category, 'nome' | 'tipo' | 'cor' | 'icone'>) => {
      const duplicate = store.categories.some(
        (c) => c.tipo === values.tipo && c.nome.toLowerCase() === values.nome.toLowerCase(),
      )
      if (duplicate) throw new UserFacingError('Já existe uma categoria com esse nome.')
      const created = makeCategory({ ...values, id: `nova-${store.nextId++}` })
      store.categories.push(created)
      return created
    }),
    updateCategory: vi.fn(async (id: string, patch: Partial<Category>) => {
      const category = store.categories.find((c) => c.id === id)!
      Object.assign(category, patch)
      return category
    }),
    deleteCategory: vi.fn(async (id: string) => {
      store.categories = store.categories.filter((c) => c.id !== id)
    }),
  }
})

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: 'id',
    user_id: 'user',
    nome: 'Categoria',
    tipo: 'despesa',
    cor: 'slate',
    icone: 'tag',
    arquivada: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  store.nextId = 1
  store.categories = [
    makeCategory({ id: 'c1', nome: 'Moradia', icone: 'house', cor: 'blue' }),
    makeCategory({ id: 'c2', nome: 'Alimentação', icone: 'utensils', cor: 'orange' }),
    makeCategory({ id: 'c3', nome: 'Antigos', arquivada: true }),
    makeCategory({ id: 'c4', nome: 'Salário', tipo: 'receita', icone: 'briefcase', cor: 'green' }),
  ]
})

const list = () => screen.getByRole('region', { name: /Categorias de/ })
const activeNames = () =>
  within(within(list()).getAllByRole('list')[0])
    .getAllByRole('button')
    .map((button) => button.textContent?.replace('Editar', '').trim())

describe('página de categorias', () => {
  it('lista as despesas ativas por ordem alfabética e esconde as arquivadas em um grupo', async () => {
    renderApp('/configuracoes/categorias')
    await waitFor(() => expect(activeNames()).toEqual(['Alimentação', 'Moradia']))
    expect(screen.getByText('Arquivadas (1)')).toBeInTheDocument()
  })

  it('alterna para receitas', async () => {
    renderApp('/configuracoes/categorias')
    await screen.findByText('Moradia')
    await userEvent.click(screen.getByRole('button', { name: 'Receitas' }))

    expect(screen.getByRole('button', { name: 'Receitas' })).toHaveAttribute('aria-pressed', 'true')
    expect(activeNames()).toEqual(['Salário'])
  })

  it('cria uma categoria nova do tipo selecionado', async () => {
    renderApp('/configuracoes/categorias')
    await screen.findByText('Moradia')

    await userEvent.click(screen.getByRole('button', { name: 'Nova categoria' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nova categoria' })
    await userEvent.type(within(dialog).getByLabelText('Nome'), '  Ginásio ')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Violeta' }))
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Esporte' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))

    await waitFor(() => expect(activeNames()).toEqual(['Alimentação', 'Ginásio', 'Moradia']))
    expect(store.categories.at(-1)).toMatchObject({
      nome: 'Ginásio',
      tipo: 'despesa',
      cor: 'violet',
      icone: 'dumbbell',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('valida o nome e mostra o erro do servidor sem fechar o diálogo', async () => {
    renderApp('/configuracoes/categorias')
    await screen.findByText('Moradia')
    await userEvent.click(screen.getByRole('button', { name: 'Nova categoria' }))
    const dialog = await screen.findByRole('dialog')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))
    expect(within(dialog).getByText('Informe o nome da categoria.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('Nome'), 'moradia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar categoria' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe uma categoria com esse nome.',
    )
  })

  it('edita o nome de uma categoria existente (sem permitir mudar o tipo)', async () => {
    renderApp('/configuracoes/categorias')
    await userEvent.click(await screen.findByRole('button', { name: /Moradia/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar categoria' })

    expect(within(dialog).queryByRole('radio', { name: 'Receita' })).not.toBeInTheDocument()
    const nome = within(dialog).getByLabelText('Nome')
    expect(nome).toHaveValue('Moradia')
    await userEvent.clear(nome)
    await userEvent.type(nome, 'Casa')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(activeNames()).toEqual(['Alimentação', 'Casa']))
  })

  it('arquiva e reativa', async () => {
    renderApp('/configuracoes/categorias')
    await userEvent.click(await screen.findByRole('button', { name: /Moradia/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Arquivar' }))

    await waitFor(() => expect(screen.getByText('Arquivadas (2)')).toBeInTheDocument())
    expect(activeNames()).toEqual(['Alimentação'])
  })

  it('apaga só depois de confirmar', async () => {
    renderApp('/configuracoes/categorias')
    await userEvent.click(await screen.findByRole('button', { name: /Alimentação/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    const confirm = await screen.findByRole('alertdialog', { name: 'Excluir “Alimentação”?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(activeNames()).toEqual(['Moradia']))
  })

  it('as Configurações têm ligação para as categorias', async () => {
    const { router } = renderApp('/configuracoes')
    await userEvent.click(screen.getByRole('link', { name: 'Categorias' }))
    expect(router.state.location.pathname).toBe('/configuracoes/categorias')
  })
})
