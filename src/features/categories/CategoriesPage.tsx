import { ArrowLeft, ChevronRight, Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import type { Category } from './categories-api'
import { CategoryBadge } from './CategoryBadge'
import { CategoryFormDialog } from './CategoryFormDialog'
import { useCategories } from './hooks'
import { TIPO_LABELS, TIPOS, type Tipo } from './schemas'

export function CategoriesPage() {
  const { data: categories, isPending, error, refetch } = useCategories()
  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [dialog, setDialog] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  })

  const ofTipo = (categories ?? []).filter((category) => category.tipo === tipo)
  const active = ofTipo.filter((category) => !category.arquivada)
  const archived = ofTipo.filter((category) => category.arquivada)

  const openNew = () => setDialog({ open: true, category: null })
  const openEdit = (category: Category) => setDialog({ open: true, category })

  return (
    <>
      <Link
        to="/configuracoes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Configurações
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Categorias" description="Organiza as tuas receitas e despesas." />
        <Button size="lg" onClick={openNew} className="max-sm:mb-3 max-sm:w-full">
          <Plus aria-hidden />
          Nova categoria
        </Button>
      </div>

      <div
        role="group"
        aria-label="Mostrar categorias de"
        className="mb-4 flex gap-1 rounded-lg bg-muted p-1 sm:w-fit"
      >
        {TIPOS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tipo === value}
            onClick={() => setTipo(value)}
            className={cn(
              'h-9 flex-1 rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              tipo === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {TIPO_LABELS[value].plural}
          </button>
        ))}
      </div>

      <section aria-label={`Categorias de ${TIPO_LABELS[tipo].plural.toLowerCase()}`}>
        {isPending ? (
          <CategoryListSkeleton />
        ) : error ? (
          <div className="grid gap-3">
            <FormAlert>{errorMessage(error)}</FormAlert>
            <Button variant="outline" className="w-fit" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : active.length === 0 && archived.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={`Sem categorias de ${TIPO_LABELS[tipo].plural.toLowerCase()}`}
            description="Cria a primeira para começares a organizar os teus movimentos."
          />
        ) : (
          <>
            <CategoryList categories={active} onSelect={openEdit} />
            {archived.length > 0 && (
              <details className="group mt-6">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
                  Arquivadas ({archived.length})
                </summary>
                <CategoryList
                  categories={archived}
                  onSelect={openEdit}
                  className="mt-2 opacity-70"
                />
              </details>
            )}
          </>
        )}
      </section>

      <CategoryFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        category={dialog.category}
        defaultTipo={tipo}
      />
    </>
  )
}

function CategoryList({
  categories,
  onSelect,
  className,
}: {
  categories: Category[]
  onSelect: (category: Category) => void
  className?: string
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todas as categorias deste tipo estão arquivadas.
      </p>
    )
  }
  return (
    <ul className={cn('divide-y rounded-xl border', className)}>
      {categories.map((category) => (
        <li key={category.id}>
          <button
            type="button"
            onClick={() => onSelect(category)}
            className="flex min-h-14 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
          >
            <CategoryBadge cor={category.cor} icone={category.icone} />
            <span className="flex-1 truncate font-medium">{category.nome}</span>
            <span className="sr-only">Editar</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function CategoryListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="A carregar categorias" className="divide-y rounded-xl border">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="flex min-h-14 items-center gap-3 px-3">
          <span className="size-9 animate-pulse rounded-full bg-muted" />
          <span className="h-4 w-32 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  )
}
