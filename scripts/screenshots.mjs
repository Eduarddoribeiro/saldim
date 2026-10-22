// Tira as capturas do README com a conta de demonstração (npm run demo:seed antes).
// Uso: npm run demo:screenshots  (com a app a correr; outro endereço: APP_URL=http://localhost:5174)
import { mkdirSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'
import { DEMO_EMAIL, DEMO_PASSWORD } from './seed-demo-credentials.mjs'

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'
const OUT = 'docs/screenshots'
const PAGES = [
  ['inicio', '/'],
  ['faturas', '/faturas'],
  ['a-receber', '/a-receber'],
  ['transacoes', '/transacoes'],
]
// No desktop basta o Início; no celular, as quatro páginas
const DEVICES = {
  desktop: { options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }, pages: 1 },
  celular: { options: { ...devices['Pixel 7'], deviceScaleFactor: 2 }, pages: PAGES.length },
}

mkdirSync(OUT, { recursive: true })
// Edge do sistema, como nos testes E2E (sem descarregar browsers)
const browser = await chromium.launch({ channel: 'msedge' })
for (const [device, { options, pages }] of Object.entries(DEVICES)) {
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
    for (const [name, path] of PAGES.slice(0, pages)) {
      await page.goto(`${APP_URL}${path}`)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800) // gráficos animados
      await page.screenshot({ path: `${OUT}/${name}-${device}-${theme}.png` })
    }
    await context.close()
  }
}
await browser.close()
console.log(`Capturas em ${OUT}/`)
