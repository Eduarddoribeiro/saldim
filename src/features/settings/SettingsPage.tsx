import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PageHeader } from '@/components/layout/PageHeader'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Preferências, categorias e contas." />
      <section className="rounded-xl border p-4">
        <h2 className="font-medium">Aparência</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Escolhe entre claro, escuro ou seguir o sistema.
        </p>
        <div className="max-w-56">
          <ThemeToggle showLabel />
        </div>
      </section>
    </>
  )
}
