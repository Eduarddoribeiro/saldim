import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Intl usa espaços não separáveis entre "R$" e o número
const money = (text: string) => new RegExp(text.replace(/[.$]/g, '\\$&').replace(' ', '\\s'))

test('contas: conta inicial, criar com saldo, editar, arquivar', async ({ page }) => {
  await signUp(page, uniqueEmail('contas'))
  await page.goto('/configuracoes')
  await page.getByRole('link', { name: 'Contas' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Contas' })).toBeVisible()

  const lista = page.getByRole('region', { name: 'Contas ativas' })
  await expect(lista.getByRole('button', { name: /Conta principal/ })).toContainText(
    money('R$ 0,00'),
  )

  // Criar com saldo inicial escrito à portuguesa
  await page.getByRole('button', { name: 'Nova conta' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nova conta' })
  await dialogo.getByLabel('Nome').fill('Poupança')
  await dialogo.getByLabel('Tipo').selectOption('poupanca')
  await dialogo.getByLabel('Saldo inicial').fill('1.234,56')
  await dialogo.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialogo).toBeHidden()
  const poupanca = lista.getByRole('button', { name: /Poupança/ })
  await expect(poupanca).toContainText(money('R$ 1.234,56'))
  await expectNoHorizontalScroll(page)

  // Editar: o campo vem preenchido sem separador de milhares
  await poupanca.click()
  const editar = page.getByRole('dialog', { name: 'Editar conta' })
  await expect(editar.getByLabel('Saldo inicial')).toHaveValue('1234,56')
  await editar.getByLabel('Saldo inicial').fill('-20')
  await editar.getByRole('button', { name: 'Guardar' }).click()
  await expect(poupanca).toContainText(money('-R$ 20,00'))

  // Arquivar
  await poupanca.click()
  await editar.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()
})
