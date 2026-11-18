/**
 * Demo pública (docs/features/demo-publica.md): só na instalação com `VITE_DEMO=true`. Mostra
 * "Explorar a demonstração" no login e prepara dados inventados na conta anónima do visitante.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO === 'true'
