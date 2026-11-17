// Capturas para comparar versões da interface (antes × depois de uma mudança visual).
// Uso: node scripts/compare-screenshots.mjs <pasta>   (app a correr + npm run demo:seed antes)
// Ex.: node scripts/compare-screenshots.mjs docs/screenshots/comparacao/antes
// APP_URL muda o endereço; PW_EXECUTABLE usa outro Chromium em vez do Edge do sistema.
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'
import { DEMO_EMAIL, DEMO_PASSWORD } from './seed-demo-credentials.mjs'

const OUT = process.argv[2]
if (!OUT) {
  console.error('Indique a pasta de saída: node scripts/compare-screenshots.mjs <pasta>')
  process.exit(1)
}
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

// Páginas (o nome do ficheiro não muda entre versões, para comparar lado a lado)
const PAGES = [
  ['inicio', '/'],
  ['extrato', '/transacoes'],
  ['cartoes', '/faturas'],
  ['a-receber', '/a-receber'],
]

// Formulário de lançamento: o botão mudou de nome entre versões
async function openNewEntry(page) {
  const names = [/^Novo lançamento/, /^Nova transação/]
  for (const name of names) {
    // Pode haver um botão por navegação (sidebar e barra inferior): usa o que estiver visível
    for (const button of await page.getByRole('button', { name }).all()) {
      if (await button.isVisible()) {
        await button.click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(500)
        return true
      }
    }
  }
  return false
}

const DEVICES = {
  celular: { ...devices['Pixel 7'], deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(
  process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : { channel: 'msedge' },
)
for (const [device, options] of Object.entries(DEVICES)) {
  for (const theme of ['claro', 'escuro']) {
    const context = await browser.newContext(options)
    await context.addInitScript(
      (value) => {
        try {
          localStorage.setItem('financas-theme', value)
        } catch {}
      },
      theme === 'claro' ? 'light' : 'dark',
    )
    const page = await context.newPage()
    await page.goto(`${APP_URL}/entrar`)
    await page.getByLabel('E-mail').fill(DEMO_EMAIL)
    await page.getByLabel('Senha').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL(`${APP_URL}/`)
    for (const [name, path] of PAGES) {
      await page.goto(`${APP_URL}${path}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800) // gráficos animados
      await page.screenshot({ path: `${OUT}/${name}-${device}-${theme}.png` })
    }
    // Formulário de lançamento, aberto a partir do Extrato (existe nas duas versões)
    await page.goto(`${APP_URL}/transacoes`)
    await page.waitForLoadState('networkidle')
    if (await openNewEntry(page)) {
      await page.screenshot({ path: `${OUT}/lancar-${device}-${theme}.png` })
    }
    await context.close()
  }
}
await browser.close()
console.log(`Capturas em ${OUT}/`)
