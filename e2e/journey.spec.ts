import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Jornada (pedido de 2026-11-26): fechar o dia no Início, criar a caixinha e guardar na reserva
// (transferência, não despesa), e as estrelas e conquistas na página Sua jornada.

const money = (text: string) => new RegExp(text.replace(/[.$+]/g, '\\$&').replace(/ /g, '\\s'))

test('fechar o dia, guardar na reserva e ver as estrelas', async ({ page }) => {
  await signUp(page, uniqueEmail('jornada'))

  // Início: sem lançamentos hoje, "Não gastei nada" fecha o dia
  const hoje = page.getByRole('region', { name: /^Hoje, / })
  await hoje.getByRole('button', { name: 'Não gastei nada' }).click()
  const festa = page.getByRole('dialog', { name: 'Dia fechado!' })
  await expect(festa).toContainText('1 dia seguido')
  await festa.getByRole('button', { name: 'Continuar' }).click()
  await expect(hoje).toContainText('Dia fechado · 1 dia seguido')
  await expectNoHorizontalScroll(page)

  // Guardar dinheiro: criar a caixinha e guardar R$ 100
  await page.goto('/guardar')
  const reserva = page.getByRole('region', { name: 'Primeiro: reserva de emergência' })
  await reserva.getByLabel('Nome da caixinha').fill('Cofrinho PicPay')
  await reserva.getByRole('button', { name: 'Criar a caixinha' }).click()
  await reserva.getByRole('button', { name: /^Guardar agora/ }).click()
  const transferir = page.getByRole('dialog', { name: 'Transferir entre contas' })
  const para = transferir.getByRole('group', { name: 'Vai para' })
  await expect(para.getByRole('radio', { name: 'Cofrinho PicPay' })).toBeChecked()
  const de = transferir.getByRole('group', { name: 'Sai de' })
  await expect(de.getByRole('radio', { name: 'Conta principal' })).toBeChecked()
  await transferir.getByLabel('Valor').fill('100')
  await transferir.getByRole('button', { name: 'Transferir' }).click()
  const guardado = page.getByRole('dialog', { name: 'Guardado!' })
  await expect(guardado).toContainText('+3 estrelas')
  await guardado.getByRole('button', { name: 'Continuar' }).click()
  await expect(reserva).toContainText(money('R$ 100,00'))
  await expect(reserva.getByRole('list', { name: 'Marcos da reserva' })).toContainText('feito')
  await expect(reserva.getByRole('list', { name: 'Últimos depósitos' })).toContainText('Reserva')
  await expectNoHorizontalScroll(page)

  // Não é despesa: o Extrato do mês não tem saídas
  await page.goto('/transacoes')
  await expect(page.getByText(/Nenhuma transação/)).toBeVisible()

  // Sua jornada: 1 dia + 3 do depósito + 5 do primeiro marco = 9 estrelas
  await page.goto('/jornada')
  await expect(page.getByText('9 estrelas')).toBeVisible()
  const conquistas = page.getByRole('list', { name: 'Conquistas' })
  await expect(conquistas.getByRole('listitem', { name: 'Primeiro depósito: ganha' })).toBeVisible()
  await expect(conquistas.getByRole('listitem', { name: 'Primeiros R$ 100: ganha' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})
