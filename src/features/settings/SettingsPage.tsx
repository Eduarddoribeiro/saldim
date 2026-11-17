import {
  ChevronRight,
  HandCoins,
  Landmark,
  Repeat,
  Tags,
  Target,
  type LucideIcon,
} from 'lucide-react'
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
    <section className="rounded-2xl border bg-card p-4">
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
        description="Orçamentos, a receber, contas, categorias e preferências."
      />
      <div className="grid gap-4">
        {/* No telemóvel esta página é o "Mais" da barra inferior: Orçamentos e A receber vêm primeiro */}
        <SettingsSection title="Planejamento" description="Limites de gastos e quem te deve.">
          <ul className="-mx-1 divide-y">
            <SettingsLink to="/orcamentos" icon={Target} label="Orçamentos" />
            <SettingsLink to="/a-receber" icon={HandCoins} label="Pessoas e a receber" />
          </ul>
        </SettingsSection>

        <SettingsSection
          title="Aparência"
          description="Escolha entre claro, escuro ou seguir o sistema."
        >
          <div className="max-w-56">
            <ThemeToggle showLabel />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Organização"
          description="Onde está seu dinheiro e como os movimentos são agrupados."
        >
          <ul className="-mx-1 divide-y">
            <SettingsLink to="/configuracoes/contas" icon={Landmark} label="Contas" />
            <SettingsLink to="/configuracoes/categorias" icon={Tags} label="Categorias" />
            <SettingsLink to="/configuracoes/recorrentes" icon={Repeat} label="Recorrentes" />
          </ul>
        </SettingsSection>

        <SettingsSection title="Conta" description={`Conectado como ${user?.email ?? '—'}.`}>
          <SignOutButton className="-ml-2.5" />
        </SettingsSection>
      </div>
    </>
  )
}
