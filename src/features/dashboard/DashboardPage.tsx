import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Início" description="Resumo das tuas finanças do mês." />
      <EmptyState
        icon={LayoutDashboard}
        title="O teu resumo aparece aqui"
        description="Saldo, receitas, despesas e gastos por categoria — disponível na Etapa 11."
      />
    </>
  )
}
