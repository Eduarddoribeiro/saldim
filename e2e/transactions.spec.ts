import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Intl usa espaços não separáveis entre "R$" e o número
const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(' ', '\\s'))

/** No telemóvel é o botão flutuante; no desktop o do cabeçalho. Usamos o que estiver visível. */
async function openNew(page: Page) {
  await page.getByRole('button', { name: 'Nova transação' }).locator('visible=true').first().click()
  return page.getByRole('dialog', { name: 'Nova transação' })
}

function isoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

test('transações: registar, ver por mês, editar, apagar', async ({ page }) => {
  await signUp(page, uniqueEmail('transacoes'))
  await page.goto('/transacoes')
  await expect(page.getByText(/Sem transações em/)).toBeVisible()

  // Despesa
  let dialogo = await openNew(page)
  await dialogo.getByLabel('Valor').fill('42,50')
  await dialogo
    .getByLabel('Descrição (opcional)')
    .fill('Supermercado do bairro com um nome muito comprido para testar o ecrã')
  await dialogo.getByLabel('Categoria').selectOption({ label: 'Alimentação' })
  await dialogo.getByRole('button', { name: 'Registar' }).click()
  await expect(dialogo).toBeHidden()
  const despesa = page.getByRole('button', { name: /Supermercado/ })
  await expect(despesa).toContainText(money('-R$ 42,50'))
  await expect(despesa.getByText(money('-R$ 42,50'))).toBeInViewport()
  await expectNoHorizontalScroll(page)

  // Receita
  dialogo = await openNew(page)
  await dialogo.locator('label', { hasText: 'Receita' }).click()
  await dialogo.getByLabel('Valor').fill('3.000')
  await dialogo.getByLabel('Categoria').selectOption({ label: 'Salário' })
  await dialogo.getByRole('button', { name: 'Registar' }).click()
  await expect(page.getByRole('button', { name: /Salário/ })).toContainText(money('+R$ 3.000,00'))

  // Despesa com data no mês anterior: não aparece neste mês, aparece ao recuar
  const now = new Date()
  const lastMonth = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 15))
  dialogo = await openNew(page)
  await dialogo.getByLabel('Valor').fill('800')
  await dialogo.getByLabel('Descrição (opcional)').fill('Renda antiga')
  await dialogo.getByLabel('Categoria').selectOption({ label: 'Moradia' })
  await dialogo.getByLabel('Data').fill(lastMonth)
  await dialogo.getByRole('button', { name: 'Registar' }).click()
  await expect(dialogo).toBeHidden()
  await expect(page.getByText('Renda antiga')).toBeHidden()

  await page.getByRole('button', { name: /Mês anterior/ }).click()
  await expect(page).toHaveURL(/\?mes=\d{4}-\d{2}$/)
  await expect(page.getByRole('button', { name: /Renda antiga/ })).toContainText(
    money('-R$ 800,00'),
  )
  await page.reload() // o mês fica no endereço
  await expect(page.getByText('Renda antiga')).toBeVisible()
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByText('Supermercado')).toBeVisible()

  // Editar
  await despesa.click()
  const editar = page.getByRole('dialog', { name: 'Editar transação' })
  await expect(editar.getByLabel('Valor')).toHaveValue('42,50')
  await editar.getByLabel('Valor').fill('50')
  await editar.getByRole('button', { name: 'Guardar' }).click()
  await expect(despesa).toContainText(money('-R$ 50,00'))

  // Apagar
  await despesa.click()
  await editar.getByRole('button', { name: 'Apagar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar' }).click()
  await expect(page.getByText('Supermercado')).toBeHidden()
})

test('uma categoria com transações não pode ser apagada (mensagem clara)', async ({ page }) => {
  await signUp(page, uniqueEmail('categoria-em-uso'))
  await page.goto('/transacoes')
  const dialogo = await openNew(page)
  await dialogo.getByLabel('Valor').fill('10')
  await dialogo.getByLabel('Categoria').selectOption({ label: 'Lazer' })
  await dialogo.getByRole('button', { name: 'Registar' }).click()
  await expect(dialogo).toBeHidden()

  await page.goto('/configuracoes/categorias')
  await page.getByRole('button', { name: /Lazer/ }).click()
  const editar = page.getByRole('dialog', { name: 'Editar categoria' })
  await editar.getByRole('button', { name: 'Apagar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Apagar' }).click()
  await expect(editar.getByRole('alert')).toHaveText(
    'Esta categoria tem transações. Arquiva-a em vez de a apagar.',
  )
})
