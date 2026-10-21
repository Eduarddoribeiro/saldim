import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('orçamentos: definir, acompanhar o estado, copiar para o mês seguinte', async ({ page }) => {
  await signUp(page, uniqueEmail('orcamentos'))

  // Uma despesa de 450,00 em Alimentação
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Nova transação' }).locator('visible=true').first().click()
  const nova = page.getByRole('dialog', { name: 'Nova transação' })
  await nova.getByLabel('Valor').fill('450')
  await nova.getByLabel('Categoria').selectOption({ label: 'Alimentação' })
  await nova.getByRole('button', { name: 'Registrar despesa' }).click()
  await expect(nova).toBeHidden()

  // Navegação: no telemóvel pela barra inferior, no desktop pela sidebar
  await page.getByRole('link', { name: 'Orçamentos' }).locator('visible=true').first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Orçamentos' })).toBeVisible()
  await expect(page.getByText(/Sem orçamentos em/)).toBeVisible()

  // Limite de 500,00 → 90 % → "Perto do limite"
  await page.getByRole('button', { name: 'Definir orçamento de Alimentação' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Definir orçamento' })
  await dialogo.getByLabel('Limite mensal').fill('500')
  await dialogo.getByRole('button', { name: 'Salvar' }).click()
  await expect(dialogo).toBeHidden()

  const linha = page.getByRole('region', { name: 'Com orçamento' }).getByRole('button', {
    name: /Alimentação/,
  })
  await expect(linha).toContainText(money('R$ 450,00 de R$ 500,00'))
  await expect(linha).toContainText('Perto do limite · 90%')
  await expect(linha).toContainText(money('Restam R$ 50,00'))
  await expectNoHorizontalScroll(page)

  // Baixar o limite para 400,00 → excedido
  await linha.click()
  const editar = page.getByRole('dialog', { name: 'Editar orçamento' })
  await editar.getByLabel('Limite mensal').fill('400')
  await editar.getByRole('button', { name: 'Salvar' }).click()
  await expect(linha).toContainText('Excedido · 113%')
  await expect(linha).toContainText(money('Excedeu em R$ 50,00'))

  // Mês seguinte: oferece copiar o orçamento
  await page.getByRole('button', { name: /Próximo mês/ }).click()
  await page.getByRole('button', { name: /Copiar de/ }).click()
  await expect(page.getByText('1 orçamento copiado.')).toBeVisible()
  const copiado = page.getByRole('region', { name: 'Com orçamento' }).getByRole('button', {
    name: /Alimentação/,
  })
  await expect(copiado).toContainText(money('R$ 0,00 de R$ 400,00'))
  await expect(copiado).toContainText('Dentro do orçamento · 0%')
})
