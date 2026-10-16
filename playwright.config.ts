import { defineConfig, devices } from '@playwright/test'

// Testes E2E: browser real → app (Vite) → Supabase LOCAL. Requer `npm run db:start` + `npm run env:local`.
// Usa o Microsoft Edge instalado no sistema (channel 'msedge'): não descarrega browsers.
// Arranca SEMPRE um Vite novo (reuseExistingServer: false): um servidor já ligado na porta podia ser
// antigo (páginas em branco) ou até de outro projeto. Porta ocupada → erro claro logo no início.
// E2E_PORT muda a porta (ex.: E2E_PORT=5174 se a 5173 estiver ocupada por outro servidor).
const port = Number(process.env.E2E_PORT ?? 5173)

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'telemovel',
      use: { ...devices['Pixel 7'], channel: 'msedge', defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
