import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(' ', '\\s'))

async function register(page: Page, tipo: 'Despesa' | 'Receita', valor: string, categoria: string) {
  await page.getByRole('button', { name: 'Nova transação' }).locator('visible=true').first().click()
  const dialogo = page.getByRole('dialog', { name: 'Nova transação' })
  if (tipo === 'Receita') await dialogo.locator('label', { hasText: 'Receita' }).click()
  await dialogo.getByLabel('Valor').fill(valor)
  await dialogo.getByLabel('Categoria').selectOption({ label: categoria })
  await dialogo.getByRole('button', { name: `Registrar ${tipo.toLowerCase()}` }).click()
  await expect(dialogo).toBeHidden()
}

test('início: saldo, resumo do mês, gastos por categoria e contas batem com o registrado', async ({
  page,
}) => {
  await signUp(page, uniqueEmail('inicio'), 'Bruno Costa')
  await expect(page.getByText('Olá, Bruno.')).toBeVisible()

  // Saldo inicial da conta: 1.000,00
  await page.goto('/configuracoes/contas')
  await page.getByRole('button', { name: /Conta principal/ }).click()
  await page.getByRole('dialog').getByLabel('Saldo inicial').fill('1.000')
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.goto('/transacoes')
  await register(page, 'Receita', '3.000', 'Salário')
  await register(page, 'Despesa', '1.200', 'Moradia')
  await register(page, 'Despesa', '300,50', 'Alimentação')

  await page.getByRole('link', { name: 'Início' }).locator('visible=true').first().click()
  const tile = (label: string) => page.getByText(label, { exact: true }).locator('..').locator('..')

  // 1000 + 3000 − 1200 − 300,50 = 2.499,50
  await expect(tile('Saldo atual')).toContainText(money('R$ 2.499,50'))
  await expect(tile('Receitas · este mês')).toContainText(money('R$ 3.000,00'))
  await expect(tile('Despesas · este mês')).toContainText(money('R$ 1.500,50'))
  await expect(tile('Resultado · este mês')).toContainText(money('+R$ 1.499,50'))

  const gastos = page.getByRole('region', { name: 'Gastos por categoria' })
  await expect(gastos.getByRole('listitem').first()).toContainText('Moradia')
  await expect(gastos.getByRole('listitem').first()).toContainText('80%')
  await expect(gastos.getByRole('listitem').nth(1)).toContainText('20%')

  await expect(page.getByRole('region', { name: 'Contas' })).toContainText(money('R$ 2.499,50'))

  // Comparação com o mês anterior (conta nova: no mês anterior não há nada)
  await expect(tile('Receitas · este mês')).toContainText(/nada em /)
  await expect(gastos.getByRole('listitem').first()).toContainText(/nada em /)

  // Receitas e despesas: gráfico real (Recharts, carregado à parte) com as barras do mês atual
  const barras = page.getByRole('region', { name: 'Receitas e despesas' })
  const graficoBarras = barras.getByRole('img', { name: /Gráfico de barras/ })
  await expect(graficoBarras.locator('.recharts-bar-rectangle path')).toHaveCount(2)
  // A dica mostra os valores exatos do mês (não os arredondados do eixo)
  await graficoBarras.locator('.recharts-bar-rectangle path').first().hover()
  const dica = graficoBarras.locator('.recharts-tooltip-wrapper')
  await expect(dica).toContainText(money('R$ 3.000,00'))
  await expect(dica).toContainText(money('R$ 1.500,50'))
  // Tabela alternativa: a última linha é o mês atual
  await barras.getByText('Ver valores em tabela').click()
  const ultimaBarras = barras.getByRole('row').last()
  await expect(ultimaBarras).toContainText(money('R$ 3.000,00'))
  await expect(ultimaBarras).toContainText(money('R$ 1.500,50'))
  await expect(ultimaBarras).toContainText(money('+R$ 1.499,50'))

  // Evolução do saldo: linha real; o último ponto (até hoje) é o saldo atual
  const evolucao = page.getByRole('region', { name: 'Evolução do saldo' })
  await expect(evolucao.locator('.saldo-realizado .recharts-line-curve')).toBeVisible()
  await evolucao.getByText('Ver valores em tabela').click()
  const ultimaSaldo = evolucao.getByRole('row').last()
  await expect(ultimaSaldo).toContainText('(até hoje)')
  await expect(ultimaSaldo).toContainText(money('R$ 2.499,50'))
  // Antes deste mês só havia o saldo inicial
  await expect(evolucao.getByRole('row').nth(-2)).toContainText(money('R$ 1.000,00'))

  await expectNoHorizontalScroll(page)
})
