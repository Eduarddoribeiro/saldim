import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'

/**
 * No login da demo pública: entrar sem conta. Cada visitante recebe uma conta anónima só dele, com
 * dados inventados (ninguém vê nem estraga o que outro visitante fez).
 */
export function DemoEntry() {
  const { signInDemo } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section
      aria-labelledby="demo-titulo"
      className="mb-4 grid gap-3 rounded-2xl bg-linear-to-b from-hero to-hero-2 p-5 text-hero-foreground"
    >
      <h2 id="demo-titulo" className="text-lg font-semibold">
        Conheça o Saldim
      </h2>
      <p className="text-sm text-hero-foreground/80">
        Entre sem cadastro numa conta de exemplo com 6 meses de dados fictícios: saldo, extrato,
        cartões com parcelas, orçamentos e quanto a irmã deve.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        size="lg"
        className="h-12 rounded-full bg-hero-foreground text-base text-hero hover:bg-hero-foreground/90"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const result = await signInDemo()
          // Com sucesso, a sessão muda e a app abre (a preparação dos dados mostra o progresso)
          if (result.error) {
            setError(result.error)
            setBusy(false)
          }
        }}
      >
        <Sparkles aria-hidden />
        {busy ? 'Entrando…' : 'Explorar a demonstração'}
      </Button>
    </section>
  )
}
