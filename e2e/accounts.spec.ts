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
  await editar.getByRole('button', { name: 'Salvar' }).click()
  await expect(poupanca).toContainText(money('-R$ 20,00'))

  // Arquivar
  await poupanca.click()
  await editar.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Arquivadas (1)')).toBeVisible()
})

test('cartão de crédito: configurar, ver na lista e não aparecer nas transações', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('cartao'))
  await page.goto('/configuracoes/contas')

  await page.getByRole('button', { name: 'Nova conta' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Nova conta' })
  await dialogo.getByLabel('Nome').fill('Visa')
  await dialogo.getByLabel('Tipo').selectOption('cartao_credito')
  await expect(dialogo.getByLabel('Saldo inicial')).toBeHidden()
  await dialogo.getByLabel('Dia de fechamento').selectOption('25')
  await dialogo.getByLabel('Dia de vencimento').selectOption('5')
  await dialogo.getByLabel('Limite de crédito').fill('5.000')
  await dialogo.getByLabel('Conta de pagamento').selectOption({ label: 'Conta principal' })
  await dialogo.getByRole('button', { name: 'Criar conta' }).click()
  await expect(dialogo).toBeHidden()

  const visa = page.getByRole('region', { name: 'Contas ativas' }).getByRole('button', {
    name: /Visa/,
  })
  await expect(visa).toContainText('Cartão de crédito · fecha dia 25 · vence dia 5')
  await expect(visa).toContainText(money('R$ 5.000,00'))
  await expectNoHorizontalScroll(page)

  // A conta que paga o cartão não pode ser apagada (mensagem clara)
  await page.getByRole('button', { name: /Conta principal/ }).click()
  const editar = page.getByRole('dialog', { name: 'Editar conta' })
  await editar.getByRole('button', { name: 'Excluir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click()
  await expect(editar.getByText(/paga a fatura de um cartão/)).toBeVisible()
  await editar.getByRole('button', { name: 'Cancelar' }).click()

  // Nas transações, o cartão não é uma conta possível
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Nova transação' }).locator('visible=true').first().click()
  const conta = page.getByRole('dialog', { name: 'Nova transação' }).getByLabel('Conta')
  await expect(conta).toHaveValue(/.+/)
  await expect(conta.locator('option', { hasText: 'Visa' })).toHaveCount(0)
})
