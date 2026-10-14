/// <reference types="vite/client" />

// Variáveis de ambiente públicas (ver .env.example). Tudo o que começa por VITE_ vai para o browser.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
