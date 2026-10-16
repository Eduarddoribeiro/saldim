import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Etapa C6: compra → fatura vencida → pagamento parcial → pagamento do resto → paga.

// Intl usa espaços não separáveis: qualquer espaço do texto aceita um espaço de qualquer tipo
const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

/** Dia 10 de há dois meses: com fecho a 25 e vencimento a 5, a fatura já venceu. */
function twoMonthsAgo() {
  const date = new Date()
  date.setDate(10)
  date.setMonth(date.getMonth() - 2)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

test('faturas: pagar em parte, pagar o resto e a fatura fica paga; o saldo não duplica', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('faturas'))

  // Sem cartões, a página explica o que fazer
  await page.getByRole('link', { name: 'Faturas' }).locator('visible=true').first().click()
  await expect(page.getByText('Ainda não tens cartões de crédito')).toBeVisible()

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

  // Compra à vista de 300,00 há dois meses
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Compra no cartão' }).click()
  const compra = page.getByRole('dialog', { name: 'Compra no cartão' })
  await compra.getByLabel('Valor total').fill('300')
  await compra.getByLabel('Descrição (opcional)').fill('Óculos')
  await compra.getByLabel('Categoria').selectOption({ label: 'Saúde' })
  await compra.getByLabel('Data da compra').fill(twoMonthsAgo())
  await compra.getByRole('button', { name: 'Registar compra' }).click()
  await expect(compra).toBeHidden()

  // A fatura está vencida e por pagar
  await page.getByRole('link', { name: 'Faturas' }).locator('visible=true').first().click()
  const lista = page.getByRole('list', { name: 'Faturas' })
  const fatura = lista.getByRole('button').first()
  await expect(fatura).toContainText('Vencida')
  await expect(fatura).toContainText(money('R$ 300,00'))
  await expectNoHorizontalScroll(page)

  // Pagamento parcial de 100,00
  await fatura.click()
  await page.getByRole('button', { name: 'Pagar fatura' }).click()
  let pagar = page.getByRole('dialog', { name: /^Pagar fatura de/ })
  await expect(pagar.getByLabel('Valor')).toHaveValue('300,00')
  await pagar.getByLabel('Valor').fill('100')
  await pagar.getByRole('button', { name: 'Registar pagamento' }).click()
  await expect(pagar).toBeHidden()
  await expect(fatura).toContainText('Vencida')
  await expect(fatura).toContainText(money('falta R$ 200,00'))
  await expect(page.getByText(/^Por pagar:/)).toContainText(money('R$ 200,00'))

  // O resto (o valor sugerido já é o que falta)
  await fatura.click()
  await page.getByRole('button', { name: 'Pagar fatura' }).click()
  pagar = page.getByRole('dialog', { name: /^Pagar fatura de/ })
  await expect(pagar.getByLabel('Valor')).toHaveValue('200,00')
  await pagar.getByRole('button', { name: 'Registar pagamento' }).click()
  await expect(pagar).toBeHidden()
  await expect(page.getByText('Nada por pagar')).toBeVisible()

  await page.getByRole('button', { name: 'Pagas' }).click()
  await expect(lista.getByRole('button').first()).toContainText('Paga')
  await lista.getByRole('button').first().click()
  const detalhe = page.getByRole('dialog', { name: /^Fatura de/ })
  await expect(
    detalhe.getByRole('list', { name: 'Pagamentos da fatura' }).getByRole('listitem'),
  ).toHaveCount(2)
  await expect(detalhe.getByRole('button', { name: 'Pagar fatura' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(detalhe).toBeHidden()

  // Início: a compra (300,00) sai uma única vez; os pagamentos só movem dinheiro para o cartão
  await page.goto('/')
  const contas = page.getByRole('region', { name: 'Contas' })
  await expect(contas.getByRole('listitem').filter({ hasText: 'Conta principal' })).toContainText(
    money('-R$ 300,00'),
  )
  await expect(contas.getByRole('listitem').filter({ hasText: 'Visa' })).toContainText(
    money('R$ 0,00'),
  )
  // O rótulo é um <p> dentro do cartão do número: subir um nível isola esse número
  const tile = (label: string) => page.getByText(label, { exact: true }).locator('..')
  // D4a: o cartão está pago, por isso o dinheiro disponível é igual ao saldo líquido
  await expect(tile('Dinheiro disponível')).toContainText(money('-R$ 300,00'))
  await expect(tile('Dívida nos cartões')).toContainText(money('R$ 0,00'))
  await expect(tile('Saldo líquido')).toContainText(money('-R$ 300,00'))
  await expect(contas.getByRole('listitem').filter({ hasText: 'Visa' })).toContainText(
    money('Limite disponível: R$ 5.000,00'),
  )
})
