import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { readPendingInvite } from './pending-invite'

/**
 * Depois de entrar ou de criar a conta, retoma um convite aberto antes (o token ficou guardado):
 * vai para /convite/:token, que o aceita. Não mostra nada.
 */
export function PendingInviteRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const token = readPendingInvite()
    if (token) navigate(`/convite/${encodeURIComponent(token)}`, { replace: true })
  }, [navigate])
  return null
}
