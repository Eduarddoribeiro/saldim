import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Etapa C4: compra parcelada no cartão, do formulário até à lista, ao Início e ao apagar.

// Intl usa espaços não separáveis: qualquer espaço do texto aceita um espaço de qualquer tipo
const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('compra no cartão: 3 parcelas, uma por mês, sem duplicar a despesa; excluir a compra', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('compra'))

  // Cartão (fecha 25, vence 5), pago pela Conta principal
  await page.goto('/configuracoes/contas')
  await page.getByRole('button', { name: 'Nova conta' }).click()
  const conta = page.getByRole('dialog', { name: 'Nova conta' })
  await conta.getByLabel('Nome').fill('Visa')
  await conta.getByLabel('Tipo').selectOption('cartao_credito')
  await conta.getByLabel('Dia de fechamento').selectOption('25')
  await conta.getByLabel('Dia de vencimento').selectOption('5')
  await conta.getByLabel('Limite de crédito').fill('5.000')
  await conta.getByLabel('Conta de pagamento').selectOption({ label: 'Conta principal' })
  await conta.getByRole('button', { name: 'Criar conta' }).click()
  await expect(conta).toBeHidden()

  // Compra de 300,00 em 3× com a data de hoje (a que vem preenchida)
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Compra no cartão' }).click()
  const compra = page.getByRole('dialog', { name: 'Compra no cartão' })
  await expect(compra.getByLabel('Cartão')).toHaveValue(/.+/)
  await compra.getByLabel('Valor total').fill('300')
  await compra.getByLabel('Número de parcelas').selectOption('3')
  await compra.getByLabel('Descrição (opcional)').fill('Bicicleta')
  await compra.getByLabel('Categoria').selectOption({ label: 'Alimentação' })
  await expect(compra.getByRole('status')).toHaveText(money('3× R$ 100,00'))
  await expect(compra.getByRole('list', { name: 'Parcelas' }).getByRole('listitem')).toHaveCount(3)
  await expectNoHorizontalScroll(page)
  await compra.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(compra).toBeHidden()

  // Este mês: só a 1.ª parcela
  const parcela = page.getByRole('button', { name: /Bicicleta/ })
  await expect(parcela).toHaveCount(1)
  await expect(parcela).toContainText('Parcela 1/3 · Alimentação · Visa')
  await expect(parcela).toContainText(money('-R$ 100,00'))
  await expectNoHorizontalScroll(page)

  // Mês seguinte: a 2.ª
  await page.getByRole('button', { name: /^Próximo mês/ }).click()
  await expect(page.getByRole('button', { name: /Bicicleta/ })).toContainText('Parcela 2/3')

  // Início: a despesa do mês é só a parcela (100,00), não o total da compra
  await page.goto('/')
  const tile = (label: string) => page.getByText(label, { exact: true }).locator('..').locator('..')
  await expect(tile('Despesas · este mês')).toContainText(money('R$ 100,00'))
  const gastos = page.getByRole('region', { name: 'Gastos por categoria' })
  await expect(gastos.getByRole('listitem').first()).toContainText('Alimentação')
  await expect(gastos.getByRole('listitem').first()).toContainText(money('R$ 100,00'))

  // Tocar numa parcela abre a compra; apagar apaga as 3 parcelas
  await page.goto('/transacoes')
  await page.getByRole('button', { name: /Bicicleta/ }).click()
  const detalhe = page.getByRole('dialog', { name: 'Bicicleta' })
  await expect(detalhe).toContainText(money('R$ 300,00'))
  await detalhe.getByRole('button', { name: 'Excluir' }).click()
  const confirmar = page.getByRole('alertdialog')
  await expect(confirmar).toContainText('As 3 parcelas são excluídas com a compra.')
  await confirmar.getByRole('button', { name: 'Excluir' }).click()
  await expect(detalhe).toBeHidden()
  await expect(page.getByText(/Sem transações em/)).toBeVisible()
  await page.getByRole('button', { name: /^Próximo mês/ }).click()
  await expect(page.getByText(/Sem transações em/)).toBeVisible()
})
