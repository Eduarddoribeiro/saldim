import { useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { FullScreenLoader } from '@/components/layout/FullScreenLoader'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { AuthCard } from '@/features/auth/AuthCard'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import { useAcceptInvite } from './hooks'
import { clearPendingInvite, savePendingInvite } from './pending-invite'

/**
 * Destino do link de convite (/convite/:token). Sem sessão: explica o convite, guarda o token e
 * manda criar conta ou entrar (depois de entrar, a app volta aqui). Com sessão: aceita e abre
 * "O que eu devo".
 */
export function InvitePage() {
  const { token = '' } = useParams()
  const { session, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <InviteWelcome token={token} />
  return <AcceptInvite token={token} />
}

function InviteWelcome({ token }: { token: string }) {
  useEffect(() => savePendingInvite(token), [token])
  const button = (variant: 'default' | 'outline') =>
    cn(buttonVariants({ variant, size: 'lg' }), 'h-12 w-full rounded-full text-base')
  return (
    <AuthCard
      title="Veja o que você deve"
      description="Alguém registra no Saldim as compras que você faz no cartão dele. Crie sua conta (ou entre) para acompanhar tudo no seu celular: quanto deve, mês a mês, e o que já pagou."
    >
      <div className="grid gap-3">
        <Link to="/cadastro" className={button('default')}>
          Criar conta
        </Link>
        <Link to="/entrar" className={button('outline')}>
          Já tenho conta
        </Link>
        <p className="text-xs text-muted-foreground">
          Você só vê as suas compras. Ninguém vê as suas outras finanças.
        </p>
      </div>
    </AuthCard>
  )
}

function AcceptInvite({ token }: { token: string }) {
  const accept = useAcceptInvite()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    // Uma só vez (o StrictMode corre os efeitos duas vezes; o convite é de uso único)
    if (started.current) return
    started.current = true
    clearPendingInvite()
    accept.mutate(token, { onSuccess: () => navigate('/o-que-devo', { replace: true }) })
  }, [accept, navigate, token])

  if (accept.isError) {
    return (
      <AuthCard title="Não foi possível abrir o convite">
        <div className="grid gap-3">
          <FormAlert>{errorMessage(accept.error)}</FormAlert>
          <p className="text-sm text-muted-foreground">Peça um link novo a quem te convidou.</p>
          <Link to="/" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}>
            Ir para o início
          </Link>
        </div>
      </AuthCard>
    )
  }
  return (
    <p role="status" className="text-center text-sm text-muted-foreground">
      Abrindo o convite…
    </p>
  )
}
