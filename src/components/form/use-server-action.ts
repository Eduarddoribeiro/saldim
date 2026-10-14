import { useState } from 'react'
import { errorMessage } from '@/lib/db-errors'

/**
 * Executa uma ação no servidor a partir de um formulário: limpa o erro anterior, corre a ação e,
 * se correr bem, chama `onSuccess` (ex.: fechar o diálogo); se falhar, guarda a mensagem para mostrar.
 */
export function useServerAction(onSuccess: () => void) {
  const [serverError, setServerError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setServerError(null)
    try {
      await action()
      onSuccess()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  return { serverError, run }
}
