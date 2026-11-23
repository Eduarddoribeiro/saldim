import { expect, test } from '@playwright/test'
import {
  expectNoHorizontalScroll,
  openNewEntry,
  PASSWORD,
  pick,
  setParcelas,
  signUp,
  uniqueEmail,
} from './helpers'

// A pessoa vê o que deve, na conta dela (docs/features/mae-ve-o-que-deve.md): o dono convida a Mãe,
// ela abre o link noutro telemóvel, cria a conta e vê só as compras dela; uma compra nova aparece-lhe;
// deixar de compartilhar corta o acesso.

const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('a mãe vê na conta dela o que deve, e só isso', async ({ page, browser }) => {
  await signUp(page, uniqueEmail('dono'), 'Edu Teste')

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

  const comprar = async (descricao: string, valor: string, mae: boolean) => {
    const compra = await openNewEntry(page)
    await pick(compra, 'Visa')
    await compra.getByLabel('Valor total').fill(valor)
    await setParcelas(compra, 3)
    if (mae) {
      await pick(compra, 'De outra pessoa')
      const pessoa = compra.getByLabel('De quem?')
      if ((await pessoa.locator('option', { hasText: 'Mãe' }).count()) > 0) {
        await pessoa.selectOption({ label: 'Mãe' })
      } else {
        await pessoa.selectOption({ label: 'Outra pessoa…' })
        await compra.getByLabel('Nome da pessoa').fill('Mãe')
      }
    }
    await compra.getByLabel('Descrição (opcional)').fill(descricao)
    await pick(compra, 'Moradia')
    await compra.getByRole('button', { name: 'Registrar compra' }).click()
    await expect(compra).toBeHidden()
  }
  await comprar('Sofá', '300', true)
  await comprar('Minha TV', '900', false)

  // Convidar
  await page.goto('/a-receber')
  const cartaoMae = page.getByRole('region', { name: 'Mãe' })
  await cartaoMae.getByRole('button', { name: 'Compartilhar com Mãe' }).click()
  const partilha = page.getByRole('dialog', { name: 'Compartilhar com Mãe' })
  await expect(partilha.getByLabel('Seu nome')).toHaveValue('Edu Teste')
  await partilha.getByRole('button', { name: 'Gerar link' }).click()
  const link = (await partilha.getByText(/\/convite\//).textContent())!.trim()
  expect(link).toMatch(/\/convite\/[0-9a-f]{64}$/)
  await expect(partilha.getByRole('link', { name: 'Enviar pelo WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/\?text=/,
  )
  await page.keyboard.press('Escape')

  // A mãe, noutro telemóvel: abre o link, cria a conta e cai em "O que eu devo"
  const maeContext = await browser.newContext({ ...test.info().project.use })
  const mae = await maeContext.newPage()
  await mae.goto(new URL(link).pathname)
  await expect(mae.getByRole('heading', { name: 'Veja o que você deve' })).toBeVisible()
  await mae.getByRole('link', { name: 'Criar conta' }).click()
  await mae.getByLabel('Nome').fill('Mãe Teste')
  await mae.getByLabel('E-mail').fill(uniqueEmail('mae'))
  await mae.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await mae.getByLabel('Confirmar senha').fill(PASSWORD)
  await mae.getByRole('button', { name: 'Criar conta' }).click()

  await expect(mae).toHaveURL(/\/o-que-devo$/)
  const divida = mae.getByRole('region', { name: 'Você deve a Edu Teste' })
  await expect(divida).toContainText(money('R$ 300,00'))
  await expect(divida).toContainText('Sofá')
  await expect(divida).not.toContainText('Minha TV')
  await expectNoHorizontalScroll(mae)

  // O dono vê que está compartilhado
  await page.reload()
  await expect(cartaoMae).toContainText('vê na conta dela')

  // Uma compra nova aparece-lhe ao abrir a página
  await comprar('Panela', '60', true)
  await mae.reload()
  await expect(divida).toContainText(money('R$ 360,00'))
  await expect(divida).toContainText('Panela')

  // Sem lançamentos próprios, abrir a app leva-a direto ao que deve (uma vez); no Início, o atalho
  await mae.goto('/')
  await expect(mae).toHaveURL(/\/o-que-devo$/)
  await mae.goto('/')
  await expect(
    mae.getByRole('link', { name: /^Você deve a Edu Teste: .*Ver o que eu devo$/ }),
  ).toBeVisible()

  // Deixar de compartilhar corta o acesso
  await page.goto('/a-receber')
  await cartaoMae.getByRole('button', { name: 'Compartilhar com Mãe' }).click()
  await page
    .getByRole('dialog', { name: 'Compartilhado com Mãe' })
    .getByRole('button', { name: 'Deixar de compartilhar' })
    .click()
  await expect(cartaoMae).not.toContainText('vê na conta dela')
  await mae.goto('/o-que-devo')
  await expect(mae.getByText('Nada por aqui')).toBeVisible()

  // O link já usado não serve a mais ninguém
  await mae.goto(new URL(link).pathname)
  await expect(mae.getByText(/Este convite não vale mais/)).toBeVisible()
  await maeContext.close()
})
