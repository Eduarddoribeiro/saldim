import { expect, type Locator, type Page } from '@playwright/test'

const MAILPIT = 'http://127.0.0.1:54324'
export const PASSWORD = 'senha-e2e-123'

export function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}@teste.local`
}

export async function signUp(page: Page, email: string, nome = 'Pessoa Teste') {
  await page.goto('/cadastro')
  await page.getByLabel('Nome').fill(nome)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirmar senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/** No telemóvel o botão Sair está nas Configurações; no desktop também está na sidebar. */
export async function logOut(page: Page) {
  await page.goto('/configuracoes')
  await page.getByRole('main').getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
}

/** Lê do Mailpit (caixa de e-mail do Supabase local) o último link enviado para `email`. */
export async function lastEmailLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages.length > 0) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json()) as {
        Text: string
      }
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?[^\s)\]]+/)?.[0]
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Nenhum e-mail com link para ${email}`)
}

/** Falha se a página tiver scroll horizontal (algo mais largo do que o ecrã). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'a página não deve ter scroll horizontal').toBeLessThanOrEqual(0)
}

/**
 * Abre o lançamento rápido pelo `+` visível (barra inferior no telemóvel, sidebar no desktop) e
 * devolve a folha/diálogo.
 */
export async function openNewEntry(page: Page) {
  await page
    .getByRole('button', { name: 'Novo lançamento' })
    .locator('visible=true')
    .first()
    .click()
  return page.getByRole('dialog', { name: 'Novo lançamento' })
}

/** Escolhe uma opção em botões (categoria, conta/cartão, data): toca na etiqueta, como o polegar. */
export async function pick(dialog: Locator, name: string) {
  const radio = dialog.getByRole('radio', { name, exact: true })
  // Categorias além das primeiras oito ficam atrás de "Mais…"
  if ((await radio.count()) === 0) await dialog.getByRole('button', { name: 'Mais…' }).click()
  // O filtro `has` procura dentro de cada etiqueta: o rádio tem de ser descrito a partir da página
  const inner = dialog.page().getByRole('radio', { name, exact: true })
  await dialog.locator('label').filter({ has: inner }).click()
  await expect(radio).toBeChecked()
}

export async function pickDate(dialog: Locator, isoDate: string) {
  await pick(dialog, 'Outra data')
  await dialog.getByLabel('Qual data?').fill(isoDate)
}

export async function setParcelas(dialog: Locator, parcelas: number) {
  for (let n = 1; n < parcelas; n++) {
    await dialog.getByRole('button', { name: 'Mais uma parcela' }).click()
  }
}

/** Vai a uma página da navegação: no telemóvel, as que não estão na barra ficam em "Mais". */
export async function goToSection(page: Page, name: string) {
  const link = page.getByRole('link', { name, exact: true }).locator('visible=true')
  if ((await link.count()) === 0) {
    await page.getByRole('link', { name: 'Mais', exact: true }).click()
  }
  await link.first().click()
}
