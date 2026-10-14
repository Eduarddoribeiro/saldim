import { defineConfig, devices } from '@playwright/test'

// Testes E2E: browser real → app (Vite) → Supabase LOCAL. Requer `npm run db:start` + `npm run env:local`.
// Usa o Microsoft Edge instalado no sistema (channel 'msedge'): não descarrega browsers.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
