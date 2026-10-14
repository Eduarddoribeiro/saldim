import { Link } from 'react-router'
import { PageHeader } from './PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página não encontrada" description="Este endereço não existe." />
      <Link to="/" className="text-sm font-medium underline underline-offset-4">
        Voltar ao início
      </Link>
    </>
  )
}
