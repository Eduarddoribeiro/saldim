import { LoaderCircle } from 'lucide-react'

/** Enquanto o código de uma página (carregado à parte, por rota) chega. */
export function PageLoader() {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      Carregando…
    </div>
  )
}
