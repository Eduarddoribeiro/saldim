// Esconder valores (o "olho" dos apps de banco): desfoca os números de dinheiro para usar a app em
// público. A escolha fica no aparelho (localStorage), como o tema; o CSS está em index.css.

export const PRIVACY_STORAGE_KEY = 'saldim-ocultar-valores'
export const PRIVACY_CLASS = 'valores-ocultos'

// localStorage pode lançar erro (modo privado, armazenamento bloqueado): nunca parte a app.
export function readHiddenValues(): boolean {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function storeHiddenValues(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(PRIVACY_STORAGE_KEY, '1')
    else localStorage.removeItem(PRIVACY_STORAGE_KEY)
  } catch {
    // Sem armazenamento a escolha vale só até fechar a app
  }
}

export function applyHiddenValues(hidden: boolean, root: HTMLElement = document.documentElement) {
  root.classList.toggle(PRIVACY_CLASS, hidden)
}
