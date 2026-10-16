import { expect, test, type Page } from '@playwright/test'
import { previewDaysChange, validateCardConfig } from '../src/lib/credit-card'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Etapa C8: estorno de uma compra parcelada e mudança dos dias de um cartão com faturas.

// Intl usa espaços não separáveis: qualquer espaço do texto aceita um espaço de qualquer tipo
const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

/** Hoje (data local, como a app) em 'YYYY-MM-DD'. */
function today() {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function criarCartao(page: Page) {
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
}

async function comprar(page: Page) {
  await page.goto('/transacoes')
  await page.getByRole('button', { name: 'Compra no cartão' }).click()
  const compra = page.getByRole('dialog', { name: 'Compra no cartão' })
  await compra.getByLabel('Valor total').fill('300')
  await compra.getByLabel('Número de parcelas').selectOption('3')
  await compra.getByLabel('Descrição (opcional)').fill('Sofá')
  await compra.getByLabel('Categoria').selectOption({ label: 'Moradia' })
  await compra.getByRole('button', { name: 'Registar compra' }).click()
  await expect(compra).toBeHidden()
}

test('estorno parcial: crédito na fatura, desconta dos gastos e da dívida', async ({ page }) => {
  await signUp(page, uniqueEmail('estorno'))
  await criarCartao(page)
  await comprar(page)

  // A parcela de hoje (1/3) abre a compra; regista um estorno de 100,00
  await page.getByRole('button', { name: /^Sofá: despesa/ }).click()
  const detalhe = page.getByRole('dialog', { name: 'Sofá' })
  await detalhe.getByRole('button', { name: 'Registar estorno' }).click()
  const form = page.getByRole('dialog', { name: 'Estorno de Sofá' })
  await expect(form.getByLabel('Valor')).toHaveValue('300,00')
  await form.getByLabel('Valor').fill('100')
  await form.getByLabel('Descrição (opcional)').fill('Devolução de uma peça')
  await form.getByRole('button', { name: 'Registar estorno' }).click()
  await expect(detalhe).toContainText(money('EstornadoR$ 100,00'))
  await page.keyboard.press('Escape')
  await expect(detalhe).toBeHidden()

  // Na lista do mês: o estorno é um crédito ligado à compra
  const estorno = page.getByRole('button', { name: /^Devolução de uma peça: estorno/ })
  await expect(estorno).toContainText('Estorno')
  await expect(estorno).toContainText(money('+R$ 100,00'))
  await expectNoHorizontalScroll(page)

  // Na fatura do mês: a parcela de 100,00 e o estorno de 100,00 → total 0
  await page.getByRole('link', { name: 'Faturas' }).locator('visible=true').first().click()
  await page.getByRole('button', { name: 'Todas' }).click()
  const lista = page.getByRole('list', { name: 'Faturas' })
  await lista
    .getByRole('button', { name: /R\$\s0,00/ })
    .first()
    .click()
  const fatura = page.getByRole('dialog', { name: /^Fatura de/ })
  await expect(
    fatura.getByRole('list', { name: 'Estornos da fatura' }).getByRole('listitem'),
  ).toContainText(money('-R$ 100,00'))
  await page.keyboard.press('Escape')

  // Início: despesas do mês 100 − 100 = 0; dívida 0 (as parcelas futuras: 200,00); limite 4.800,00
  await page.goto('/')
  const tile = (label: string) => page.getByText(label, { exact: true }).locator('..')
  await expect(tile('Despesas · este mês')).toContainText(money('R$ 0,00'))
  await expect(tile('Dívida nos cartões')).toContainText(money('R$ 0,00'))
  await expect(tile('Dívida nos cartões')).toContainText(
    money('Com as parcelas futuras: R$ 200,00'),
  )
  await expect(
    page.getByRole('region', { name: 'Contas' }).getByRole('listitem').filter({ hasText: 'Visa' }),
  ).toContainText(money('Limite disponível: R$ 4.800,00'))
})

test('mudar os dias de um cartão com faturas: avisa e recalcula a fatura aberta', async ({
  page,
}) => {
  // Uns dias novos que a mudança de hoje aceita (a fatura aberta continua a fechar depois de hoje)
  const antigos = { diaFechamento: 25, diaVencimento: 5 }
  const [novos, previsto] = [
    { diaFechamento: 10, diaVencimento: 20 },
    { diaFechamento: 1, diaVencimento: 10 },
    { diaFechamento: 20, diaVencimento: 1 },
    { diaFechamento: 15, diaVencimento: 25 },
  ]
    .filter((config) => validateCardConfig({ ...config, limiteCentavos: 1 }).ok)
    .map((config) => [config, previewDaysChange(antigos, [], config, today())] as const)
    .find(([, preview]) => preview.ok)!
  if (!previsto.ok) throw new Error('sem dias aceites para hoje')
  const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

  await signUp(page, uniqueEmail('dias'))
  await criarCartao(page)
  await comprar(page)

  await page.goto('/configuracoes/contas')
  await page.getByRole('button', { name: /Visa/ }).click()
  const editar = page.getByRole('dialog', { name: 'Editar conta' })
  await editar.getByLabel('Dia de fechamento').selectOption(String(novos.diaFechamento))
  await editar.getByLabel('Dia de vencimento').selectOption(String(novos.diaVencimento))
  await expect(editar.getByText(/^Os dias novos valem a partir da fatura de/)).toBeVisible()
  await editar.getByRole('button', { name: 'Guardar' }).click()
  await expect(editar).toBeHidden()

  // A fatura aberta passou aos dias novos
  await page.getByRole('link', { name: 'Faturas' }).locator('visible=true').first().click()
  await page.getByRole('button', { name: 'Todas' }).click()
  await expect(
    page
      .getByRole('list', { name: 'Faturas' })
      .getByText(
        `Fecha ${ddmm(previsto.novas.fechamento)} · vence ${ddmm(previsto.novas.vencimento)}`,
      ),
  ).toBeVisible()
})
