import { zodResolver } from '@hookform/resolvers/zod'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { FormAlert } from '@/components/form/FormAlert'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { TextField } from '@/components/form/TextField'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import type { Category } from './categories-api'
import { CategoryBadge } from './CategoryBadge'
import { CATEGORY_COLORS, CATEGORY_ICONS, COLOR_KEYS, ICON_KEYS } from './category-options'
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from './hooks'
import {
  categoryFormSchema,
  TIPO_LABELS,
  TIPOS,
  type CategoryFormValues,
  type Tipo,
} from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Categoria a editar; sem ela, o diálogo cria uma nova. */
  category?: Category | null
  defaultTipo: Tipo
}

export function CategoryFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {/* key: ao abrir para outra categoria, o formulário recomeça com os valores dela */}
        {props.open && <CategoryForm key={props.category?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({ onOpenChange, category, defaultTipo }: Props) {
  const isEdit = Boolean(category)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: category
      ? {
          nome: category.nome,
          tipo: category.tipo,
          cor: category.cor as CategoryFormValues['cor'],
          icone: category.icone as CategoryFormValues['icone'],
        }
      : { nome: '', tipo: defaultTipo, cor: 'slate', icone: 'tag' },
  })
  const [cor, icone] = useWatch({ control, name: ['cor', 'icone'] })

  async function run(action: () => Promise<unknown>) {
    setServerError(null)
    try {
      await action()
      onOpenChange(false)
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  const onSubmit = handleSubmit(({ nome, tipo, cor, icone }) =>
    run(() =>
      category
        ? update.mutateAsync({ id: category.id, patch: { nome, cor, icone } })
        : create.mutateAsync({ nome, tipo, cor, icone }),
    ),
  )

  const busy = isSubmitting || update.isPending || remove.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? `Categoria de ${TIPO_LABELS[category!.tipo].plural.toLowerCase()}.`
            : 'Usada para organizar as tuas receitas e despesas.'}
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <div className="flex items-end gap-3">
        <CategoryBadge cor={cor} icone={icone} className="mb-0.5" />
        <div className="flex-1">
          <TextField
            id="categoria-nome"
            label="Nome"
            autoComplete="off"
            maxLength={40}
            error={errors.nome?.message}
            {...register('nome')}
          />
        </div>
      </div>

      {!isEdit && (
        <SegmentedControl
          legend="Tipo"
          options={TIPOS.map((tipo) => ({ value: tipo, label: TIPO_LABELS[tipo].singular }))}
          {...register('tipo')}
        />
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEYS.map((key) => (
            <label key={key} title={CATEGORY_COLORS[key].label}>
              <input type="radio" value={key} className="peer sr-only" {...register('cor')} />
              <span className="sr-only">{CATEGORY_COLORS[key].label}</span>
              <span
                aria-hidden
                className={cn(
                  'block size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-popover transition',
                  'peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/60',
                  CATEGORY_COLORS[key].swatch,
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Ícone</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {ICON_KEYS.map((key) => {
            const { icon: Icon, label } = CATEGORY_ICONS[key]
            return (
              <label key={key} title={label}>
                <input type="radio" value={key} className="peer sr-only" {...register('icone')} />
                <span className="sr-only">{label}</span>
                <span
                  aria-hidden
                  className={cn(
                    'flex aspect-square cursor-pointer items-center justify-center rounded-lg border text-muted-foreground transition-colors',
                    'peer-checked:border-foreground peer-checked:bg-muted peer-checked:text-foreground hover:bg-muted',
                    'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {category && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(() =>
                update.mutateAsync({ id: category.id, patch: { arquivada: !category.arquivada } }),
              )
            }
          >
            {category.arquivada ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {category.arquivada ? 'Reativar' : 'Arquivar'}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden />
            Apagar
          </Button>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar categoria'}
        </Button>
      </DialogFooter>

      {category && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar “{category.nome}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Se a categoria já tiver transações, arquiva-a em
                vez de a apagar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => {
                  setConfirmDelete(false)
                  void run(() => remove.mutateAsync(category.id))
                }}
              >
                Apagar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  )
}
