import { expect, test, type Page } from '@playwright/test'
import { nextOccurrence } from '../src/lib/recurrence'
import { expectNoHorizontalScroll, signUp, uniqueEmail } from './helpers'

// Etapa R1: um recorrente com a próxima data hoje é criado logo (na conta e no cartão), aparece nas
// transações como "Recorrente" e não se duplica ao voltar a abrir a app.

/** Hoje (data local, como a app) em 'YYYY-MM-DD'. */
function today() {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const ddmmyyyy = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

async function novoRecorrente(
  page: Page,
  {
    nome,
    valor,
    conta,
    categoria,
  }: { nome: string; valor: string; conta: string; categoria: string },
) {
  await page.getByRole('button', { name: 'Novo recorrente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo recorrente' })
  await dialog.getByLabel('Nome').fill(nome)
  await dialog.getByLabel('Valor').fill(valor)
  await dialog.getByLabel('Conta ou cartão').selectOption({ label: conta })
  await dialog.getByLabel('Categoria').selectOption({ label: categoria })
  // A próxima data vem preenchida com hoje
  await expect(dialog.getByLabel('Próxima data')).toHaveValue(today())
  await dialog.getByRole('button', { name: 'Criar' }).click()
  await expect(dialog).toBeHidden()
}

test('recorrente na conta e no cartão: criado no dia, sem duplicar', async ({ page }) => {
  await signUp(page, uniqueEmail('recorrente'))

  // Um cartão para a assinatura
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

  await page.goto('/configuracoes')
  await page.getByRole('link', { name: 'Recorrentes' }).click()
  await expect(page.getByText('Ainda sem recorrentes')).toBeVisible()

  await novoRecorrente(page, {
    nome: 'Ginásio',
    valor: '99,90',
    conta: 'Conta principal',
    categoria: 'Saúde',
  })
  await novoRecorrente(page, { nome: 'Spotify', valor: '21,90', conta: 'Visa', categoria: 'Lazer' })

  // O de hoje já foi criado: a próxima data passou para o mês seguinte
  const proxima = nextOccurrence(today(), 'mensal', Number(today().slice(8, 10)))
  const lista = page.getByRole('list', { name: 'Recorrentes' })
  await expect(lista.getByRole('listitem')).toHaveCount(2)
  for (const item of await lista.getByRole('listitem').all()) {
    await expect(item).toContainText(`Próximo: ${ddmmyyyy(proxima)}`)
  }
  await expectNoHorizontalScroll(page)

  // Nas transações do mês: os dois, marcados como recorrentes (o do cartão sem "Parcela 1/1")
  await page.goto('/transacoes')
  const ginasio = page.getByRole('button', { name: /^Ginásio: despesa/ })
  await expect(ginasio).toContainText('Recorrente')
  const spotify = page.getByRole('button', { name: /^Spotify: despesa/ })
  await expect(spotify).toContainText('Recorrente')
  await expect(spotify).toContainText('Visa')
  await expect(spotify).not.toContainText('Parcela')

  // Abrir a app de novo não duplica
  await page.reload()
  await expect(page.getByRole('button', { name: /^Ginásio: despesa/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Spotify: despesa/ })).toHaveCount(1)
})
