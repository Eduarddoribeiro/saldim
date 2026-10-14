import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'

/** Termina a sessão; <RequireAuth> leva para o login (sem lembrar a página, porque a saída foi voluntária). */
export function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth()
  const [pending, setPending] = useState(false)

  return (
    <Button
      variant="ghost"
      size="lg"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const { error } = await signOut()
        // Em caso de erro (ex.: sem rede) o botão volta a ficar disponível; a sessão local é limpa na mesma.
        if (error) setPending(false)
      }}
    >
      <LogOut aria-hidden />
      {pending ? 'A sair…' : 'Sair'}
    </Button>
  )
}
