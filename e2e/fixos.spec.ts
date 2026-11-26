import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, openNewEntry, pick, signUp, uniqueEmail } from './helpers'

// Fixos (pedido de 2026-11-25): "Repete todo mês" no + cadastra o fixo; o Início mostra o que entra,
// o que sai e o que sobra; Fixos junta tudo numa página; Guardar dinheiro parte da sobra.

const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('fixos: do + ao Início, à página Fixos e a Guardar dinheiro', async ({ page }) => {
  await signUp(page, uniqueEmail('fixos'))

  const lancar = async (
    tipo: 'Receita' | 'Despesa',
    valor: string,
    categoria: string,
    nome: string,
  ) => {
    const dialog = await openNewEntry(page)
    await pick(dialog, tipo)
    await dialog.getByRole('textbox', { name: 'Valor' }).fill(valor)
    await pick(dialog, categoria)
    await dialog.getByLabel('Descrição (opcional)').fill(nome)
    await dialog.getByRole('switch', { name: /Repete todo mês/ }).check()
    await dialog.getByRole('button', { name: `Registrar ${tipo.toLowerCase()}` }).click()
    await expect(dialog).toBeHidden()
  }
  await lancar('Receita', '3.000', 'Salário', 'Salário')
  await lancar('Despesa', '1.200', 'Moradia', 'Aluguel')

  // Início: o mês fixo
  await page.goto('/')
  const mes = page.getByRole('region', { name: 'Seu mês fixo' })
  await expect(mes).toContainText(money('R$ 3.000,00'))
  await expect(mes).toContainText(money('R$ 1.200,00'))
  await expect(mes).toContainText(money('R$ 1.800,00'))
  await expect(mes.getByRole('list', { name: 'De onde vem' })).toContainText('Salário')
  await expect(mes.getByRole('list', { name: 'Onde vai' })).toContainText('Moradia')
  await expectNoHorizontalScroll(page)

  // Fixos: os dois cadastrados, cada um no seu lado
  await mes.getByRole('link', { name: 'Ver fixos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Fixos' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Sai todo mês' })).toContainText('Aluguel')
  await expect(page.getByRole('list', { name: 'Entra todo mês' })).toContainText('Salário')
  await expectNoHorizontalScroll(page)

  // Guardar dinheiro: 30% da sobra
  await page.goto('/configuracoes')
  await page.getByRole('link', { name: 'Guardar dinheiro' }).click()
  const guardar = page.getByRole('region', { name: 'Quanto guardar' })
  await expect(guardar).toContainText(money('R$ 540,00'))
  await expect(
    page.getByRole('list', { name: 'Quanto rende em cada aplicação' }).getByRole('listitem'),
  ).toHaveCount(4)
  await expectNoHorizontalScroll(page)
})
