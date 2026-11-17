import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { applyHiddenValues, readHiddenValues, storeHiddenValues } from '@/lib/privacy'

/** Botão do olho: esconde ou mostra os valores em toda a app (a escolha fica no aparelho). */
export function PrivacyToggle({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(readHiddenValues)

  useEffect(() => applyHiddenValues(hidden), [hidden])

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}
      onClick={() => {
        storeHiddenValues(!hidden)
        setHidden(!hidden)
      }}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full transition-colors',
        'hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-hero-accent/60 focus-visible:outline-none',
        className,
      )}
    >
      {hidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
    </button>
  )
}
