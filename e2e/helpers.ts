import { expect, type Page } from '@playwright/test'

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
