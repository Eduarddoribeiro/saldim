import { ArrowLeftRight } from 'lucide-react'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'

export function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transações" description="Receitas e despesas registadas." />
      <EmptyState
        icon={ArrowLeftRight}
        title="Ainda sem transações"
        description="Vais poder registar receitas e despesas na Etapa 9."
      />
    </>
  )
}
