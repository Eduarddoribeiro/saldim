import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Etapa T1: uma compra da mãe no cartão conta na dívida e no limite, não nos gastos; o que ela deve
// aparece no Início e na página "A receber"; o pagamento dela entra na conta sem ser receita.

// Intl usa espaços não separáveis: qualquer espaço do texto aceita um espaço de qualquer tipo
const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('compra da mãe: fora dos gastos, a receber no Início, pagamento recebido', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('terceiros'))

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

  // Compra de 300,00 em 3× para a mãe (pessoa nova, criada ao registar)
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Compra no cartão' }).click()
  const compra = page.getByRole('dialog', { name: 'Compra no cartão' })
  await compra.getByLabel('Valor total').fill('300')
  await compra.getByLabel('Número de parcelas').selectOption('3')
  await compra.getByLabel('De quem é a compra?').selectOption({ label: 'Outra pessoa…' })
  await compra.getByLabel('Nome da pessoa').fill('Mãe')
  await compra.getByLabel('Descrição (opcional)').fill('Sofá')
  await compra.getByLabel('Categoria').selectOption({ label: 'Moradia' })
  await compra.getByRole('button', { name: 'Registrar compra' }).click()
  await expect(compra).toBeHidden()
  await expect(page.getByRole('button', { name: /^Sofá: despesa/ })).toContainText('Para Mãe')

  // Início: não é gasto meu; a dívida inclui a parcela de hoje; a mãe deve 300,00
  await page.goto('/')
  const tile = (label: string) => page.getByText(label, { exact: true }).locator('..')
  await expect(tile('Despesas · este mês')).toContainText(money('R$ 0,00'))
  await expect(tile('Dívida nos cartões')).toContainText(money('R$ 100,00'))
  await expect(tile('A receber')).toContainText(money('Mãe: R$ 300,00'))
  // Líquido = 0,00 − 100,00 + 300,00
  await expect(tile('Saldo líquido')).toContainText(money('R$ 200,00'))

  // A mãe devolve 100,00 por Pix
  await tile('A receber').getByRole('link', { name: 'Ver detalhes' }).click()
  const mae = page.getByRole('region', { name: 'Mãe' })
  await expect(mae).toContainText(money('Deve R$ 300,00'))
  await mae.getByRole('button', { name: 'Recebi' }).click()
  const pagamento = page.getByRole('dialog', { name: 'Pagamento de Mãe' })
  await pagamento.getByLabel('Valor').fill('100')
  await pagamento.getByLabel('Descrição (opcional)').fill('Pix')
  await pagamento.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(pagamento).toBeHidden()
  await expect(mae).toContainText(money('Deve R$ 200,00'))
  await expectNoHorizontalScroll(page)

  // O dinheiro entrou na conta, sem contar como receita; o líquido não muda
  await page.goto('/')
  await expect(tile('Dinheiro disponível')).toContainText(money('R$ 100,00'))
  await expect(tile('Receitas · este mês')).toContainText(money('R$ 0,00'))
  await expect(tile('A receber')).toContainText(money('Mãe: R$ 200,00'))
  await expect(tile('Saldo líquido')).toContainText(money('R$ 200,00'))
})
