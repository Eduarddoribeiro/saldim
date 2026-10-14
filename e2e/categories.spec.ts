import { expect, test } from '@playwright/test'
import { signUp, uniqueEmail } from './helpers'

test('categorias: iniciais, criar, editar, arquivar', async ({ page }) => {
  await signUp(page, uniqueEmail('categorias'))

  // Chega-se às categorias pelas Configurações (o caminho funciona em telemóvel e desktop)
  await page.goto('/configuracoes')
  await page.getByRole('link', { name: 'Categorias' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Categorias' })).toBeVisible()

  const lista = page.getByRole('region', { name: 'Categorias de despesas' })
  await expect(lista.getByRole('button', { name: /Alimentação/ })).toBeVisible()
  await expect(lista.getByRole('listitem')).toHaveCount(9)

  // Criar
  await page.getByRole('button', { name: 'Nova categoria' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nova categoria' })
  await dialogo.getByLabel('Nome').fill('Ginásio')
  // Como uma pessoa: clica na amostra visível (a label), que seleciona o rádio associado
  const opcao = (nome: string) =>
    dialogo.locator('label', { has: page.getByRole('radio', { name: nome }) })
  await opcao('Violeta').click()
  await opcao('Desporto').click()
  await expect(dialogo.getByRole('radio', { name: 'Violeta' })).toBeChecked()
  await expect(dialogo.getByRole('radio', { name: 'Desporto' })).toBeChecked()
  await dialogo.getByRole('button', { name: 'Criar categoria' }).click()
  await expect(dialogo).toBeHidden()
  await expect(lista.getByRole('button', { name: /Ginásio/ })).toBeVisible()

  // Nome repetido → erro do servidor (índice único) sem fechar o diálogo
  await page.getByRole('button', { name: 'Nova categoria' }).click()
  await dialogo.getByLabel('Nome').fill('ginásio')
  await dialogo.getByRole('button', { name: 'Criar categoria' }).click()
  await expect(dialogo.getByRole('alert')).toHaveText('Já existe uma categoria com esse nome.')
  await dialogo.getByRole('button', { name: 'Cancelar' }).click()

  // Editar
  await lista.getByRole('button', { name: /Ginásio/ }).click()
  const editar = page.getByRole('dialog', { name: 'Editar categoria' })
  await editar.getByLabel('Nome').fill('Desporto')
  await editar.getByRole('button', { name: 'Guardar' }).click()
  await expect(lista.getByRole('button', { name: /Desporto/ })).toBeVisible()

  // Arquivar
  await lista.getByRole('button', { name: /Desporto/ }).click()
  await editar.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()
  await expect(lista.getByRole('listitem')).toHaveCount(9) // o grupo das arquivadas começa fechado
  await page.getByText('Arquivadas (1)').click()
  await expect(lista.getByRole('button', { name: /Desporto/ })).toBeVisible()
  await expect(lista.getByRole('listitem')).toHaveCount(10)

  // Os dados persistem no servidor
  await page.reload()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()

  // Receitas
  await page.getByRole('button', { name: 'Receitas' }).click()
  await expect(
    page
      .getByRole('region', { name: 'Categorias de receitas' })
      .getByRole('button', { name: /Salário/ }),
  ).toBeVisible()
})
