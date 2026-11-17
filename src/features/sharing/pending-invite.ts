// Convite aberto antes de ter conta: guarda-se o token para o retomar depois de entrar ou de criar
// a conta (também se a confirmação por e-mail levar a pessoa a outra página). Acessos ao
// localStorage sempre em try/catch (modo privado, armazenamento bloqueado).

const KEY = 'saldim-convite-pendente'

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // Sem armazenamento: a pessoa terá de abrir o link de novo depois de entrar
  }
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nada a fazer
  }
}
