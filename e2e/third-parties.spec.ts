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
  // Receitas/despesas do mês ficam na secção do mês (o nome também aparece no gráfico)
  const monthTile = (label: string) =>
    page.getByRole('region', { name: 'este mês' }).getByText(label, { exact: true }).locator('..')
  await expect(monthTile('Despesas')).toContainText(money('R$ 0,00'))
  await expect(tile('Dívida nos cartões')).toContainText(money('R$ 100,00'))
  await expect(tile('A receber')).toContainText(money('Mãe: R$ 300,00'))
  // Líquido = 0,00 − 100,00 + 100,00: hoje, do que a mãe deve, só conta a parcela que já está na
  // dívida do cartão (D20); a compra não é minha, por isso o líquido não muda
  await expect(tile('Saldo líquido')).toContainText(money('R$ 0,00'))

  // A mãe devolve 100,00 por Pix
  await tile('A receber').getByRole('link', { name: 'Ver quem deve' }).click()
  const mae = page.getByRole('region', { name: 'Mãe' })
  await expect(mae).toContainText(money('Deve R$ 300,00'))
  // Próximas faturas: as 3 parcelas ainda não venceram, uma por mês
  const proximas = mae.getByRole('region', { name: 'Próximas faturas' })
  await expect(proximas.locator('summary')).toHaveCount(3)
  for (const summary of await proximas.locator('summary').all())
    await expect(summary).toContainText(money('R$ 100,00'))
  await expect(mae).toContainText(/Para ficar em dia até \d{2}\/\d{2}:/)
  // Abrir um mês mostra a compra e não alarga a página (nomes longos de cartão encolhem)
  await proximas.locator('summary').first().click()
  await expect(proximas.getByRole('list', { name: 'Compras no Visa' })).toContainText('Sofá')
  await expectNoHorizontalScroll(page)
  await mae.getByRole('button', { name: 'Recebi de Mãe' }).click()
  const pagamento = page.getByRole('dialog', { name: 'Pagamento de Mãe' })
  await pagamento.getByLabel('Valor').fill('100')
  await pagamento.getByLabel('Descrição (opcional)').fill('Pix')
  await pagamento.getByRole('button', { name: 'Registrar pagamento' }).click()
  await expect(pagamento).toBeHidden()
  await expect(mae).toContainText(money('Deve R$ 200,00'))
  // O pagamento a mais (nada tinha vencido) abate o mês mais próximo: ficam 2 meses
  await expect(proximas.locator('summary')).toHaveCount(2)
  await expectNoHorizontalScroll(page)

  // O dinheiro entrou na conta, sem contar como receita; o líquido não muda
  await page.goto('/')
  await expect(tile('Dinheiro disponível')).toContainText(money('R$ 100,00'))
  await expect(monthTile('Receitas')).toContainText(money('R$ 0,00'))
  await expect(tile('A receber')).toContainText(money('Mãe: R$ 200,00'))
  // 100,00 − 100,00 + (100,00 − 100,00 devolvidos)
  await expect(tile('Saldo líquido')).toContainText(money('R$ 0,00'))
})
