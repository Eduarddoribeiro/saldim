import { ChevronRight, HandCoins, Landmark, Repeat, Tags, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
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

function SettingsLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-12 items-center gap-3 rounded-lg px-1 font-medium hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1">{label}</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}

export function SettingsPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Preferências, contas, categorias e recorrentes."
      />
      <div className="grid gap-4">
        <SettingsSection
          title="Aparência"
          description="Escolhe entre claro, escuro ou seguir o sistema."
        >
          <div className="max-w-56">
            <ThemeToggle showLabel />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Organização"
          description="Onde está o teu dinheiro e como os movimentos são agrupados."
        >
          <ul className="-mx-1 divide-y">
            <SettingsLink to="/configuracoes/contas" icon={Landmark} label="Contas" />
            <SettingsLink to="/configuracoes/categorias" icon={Tags} label="Categorias" />
            <SettingsLink to="/configuracoes/recorrentes" icon={Repeat} label="Recorrentes" />
            <SettingsLink to="/a-receber" icon={HandCoins} label="Pessoas e a receber" />
          </ul>
        </SettingsSection>

        <SettingsSection title="Conta" description={`Sessão iniciada como ${user?.email ?? '—'}.`}>
          <SignOutButton className="-ml-2.5" />
        </SettingsSection>
      </div>
    </>
  )
}
