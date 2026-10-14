import { expect, test } from '@playwright/test'
import { lastEmailLink, logIn, logOut, PASSWORD, signUp, uniqueEmail } from './helpers'

test('registo → sessão persiste → sair → entrar', async ({ page }) => {
  const email = uniqueEmail('registo')
  await signUp(page, email)

  // A sessão sobrevive a um recarregamento da página
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()

  await logOut(page)
  await logIn(page, email)
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
})

test('página protegida → login → volta à página pedida', async ({ page }) => {
  const email = uniqueEmail('voltar')
  await signUp(page, email)
  await logOut(page)

  await page.goto('/transacoes')
  await expect(page).toHaveURL(/\/entrar$/)
  await logIn(page, email)
  await expect(page).toHaveURL(/\/transacoes$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Transações' })).toBeVisible()
})

test('senha errada mostra erro em português', async ({ page }) => {
  const email = uniqueEmail('errada')
  await signUp(page, email)
  await logOut(page)

  await logIn(page, email, 'senha-errada')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/\/entrar$/)
})

test('recuperar senha pelo link do e-mail', async ({ page }) => {
  const email = uniqueEmail('recuperar')
  await signUp(page, email)
  await logOut(page)

  await page.getByRole('link', { name: 'Esqueci-me da senha' }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('button', { name: 'Enviar link' }).click()
  await expect(page.getByRole('status')).toContainText('Se existir uma conta')

  await page.goto(await lastEmailLink(email))
  await expect(page).toHaveURL(/\/nova-senha/)
  const novaSenha = `${PASSWORD}-nova`
  await page.getByLabel('Nova senha', { exact: true }).fill(novaSenha)
  await page.getByLabel('Confirmar nova senha').fill(novaSenha)
  await page.getByRole('button', { name: 'Guardar nova senha' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()

  // A senha antiga deixa de funcionar; a nova funciona
  await logOut(page)
  await logIn(page, email, PASSWORD)
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await logIn(page, email, novaSenha)
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible()
})
