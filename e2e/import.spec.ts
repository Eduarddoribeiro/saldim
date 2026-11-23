import { expect, test } from '@playwright/test'
import { goToSection, signUp, uniqueEmail } from './helpers'

// Importar (docs/features/importar.md): a fatura do banco entra de uma vez, com a parcela como
// compra parcelada; importar o mesmo ficheiro outra vez não duplica nada.

const fatura = [
  'date,title,amount',
  '2026-11-18,Merc Acougue Autodromo,56.30',
  '2026-11-17,Mercadolivre - Parcela 1/2,33.33',
  '2026-11-15,Pagamento recebido,-100.00',
].join('\n')

test('importa a fatura do cartão sem duplicar', async ({ page }) => {
  await signUp(page, uniqueEmail('importar'))
  await page.goto('/configuracoes/contas')
  await page.getByRole('button', { name: 'Nova conta' }).click()
  const conta = page.getByRole('dialog', { name: 'Nova conta' })
  await conta.getByLabel('Nome').fill('Picpay')
  await conta.getByLabel('Tipo').selectOption('cartao_credito')
  await conta.getByLabel('Dia de fechamento').selectOption('9')
  await conta.getByLabel('Dia de vencimento').selectOption('15')
  await conta.getByLabel('Limite de crédito').fill('5.000')
  await conta.getByLabel('Conta de pagamento').selectOption({ label: 'Conta principal' })
  await conta.getByRole('button', { name: 'Criar conta' }).click()
  await expect(conta).toBeHidden()

  await page.goto('/transacoes')
  await page.getByRole('link', { name: 'Importar do banco' }).click()
  await expect(page.getByRole('heading', { name: 'Importar', level: 1 })).toBeVisible()
  await page
    .locator('label')
    .filter({ hasText: /^Picpay$/ })
    .click()
  const upload = () =>
    page.locator('#importar-ficheiro').setInputFiles({
      name: 'fatura-picpay.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(fatura),
    })
  await upload()

  const lista = page.getByRole('list', { name: 'Lançamentos do ficheiro' })
  await expect(lista.getByRole('listitem')).toHaveCount(2)
  await expect(lista).toContainText('Parcela 1/2')
  // O açougue entra em Alimentação (palavra-chave); o pagamento fica de fora
  await expect(page.getByLabel('Categoria de Merc Acougue Autodromo')).toHaveValue(/.+/)
  await expect(
    page.getByLabel('Categoria de Merc Acougue Autodromo').locator('option:checked'),
  ).toHaveText('Alimentação')
  await page.getByRole('button', { name: 'Importar 2 lançamentos' }).click()
  await expect(page.getByRole('status')).toContainText('2 lançamentos importados.')

  // A mesma fatura outra vez: nada de novo
  await upload()
  await expect(page.getByText('Tudo o que está neste ficheiro já está no Saldim.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importar 0 lançamentos' })).toBeDisabled()

  // A parcela virou a compra de 2× (a 2.ª fica para a fatura seguinte)
  await goToSection(page, 'Cartões')
  await expect(page.getByRole('region', { name: 'Próximas faturas' })).toContainText('Mercadolivre')
})
