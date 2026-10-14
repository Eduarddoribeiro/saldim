import type { ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useAuth } from '@/features/auth/auth-context'
import { SignOutButton } from '@/features/auth/SignOutButton'

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader title="Configurações" description="Preferências, categorias e contas." />
      <div className="grid gap-4">
        <SettingsSection
          title="Aparência"
          description="Escolhe entre claro, escuro ou seguir o sistema."
        >
          <div className="max-w-56">
            <ThemeToggle showLabel />
          </div>
        </SettingsSection>

        <SettingsSection title="Conta" description={`Sessão iniciada como ${user?.email ?? '—'}.`}>
          <SignOutButton className="-ml-2.5" />
        </SettingsSection>
      </div>
    </>
  )
}
