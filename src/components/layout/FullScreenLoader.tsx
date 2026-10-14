import { LoaderCircle } from 'lucide-react'

export function FullScreenLoader({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground"
    >
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}
