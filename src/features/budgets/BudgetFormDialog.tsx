import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { formatMonth, type MonthKey } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE, moneyField } from '@/lib/money-schema'
import type { Budget } from './budgets-api'
import { useDeleteBudget, useSaveBudget } from './hooks'

const budgetFormSchema = z.object({ limite: moneyField({ positive: true }) })

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  /** Orçamento existente (editar) ou null (definir). */
  budget: Budget | null
  month: MonthKey
}

export function BudgetFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {props.open && props.category && (
          <BudgetForm
            key={`${props.category.id}-${props.month}`}
            {...props}
            category={props.category}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function BudgetForm({ onOpenChange, category, budget, month }: Props & { category: Category }) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const save = useSaveBudget()
  const remove = useDeleteBudget()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof budgetFormSchema>, unknown, z.output<typeof budgetFormSchema>>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { limite: budget ? centsToInput(budget.limite_centavos) : '' },
  })

  const onSubmit = handleSubmit(({ limite }) =>
    run(() => save.mutateAsync({ id: budget?.id, categoryId: category.id, month, limite })),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{budget ? 'Editar orçamento' : 'Definir orçamento'}</DialogTitle>
        <DialogDescription>
          Quanto queres gastar no máximo em {formatMonth(month)}.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <div className="flex items-center gap-3">
        <CategoryBadge cor={category.cor} icone={category.icone} />
        <span className="font-medium">{category.nome}</span>
      </div>

      <TextField
        id="orcamento-limite"
        label="Limite mensal"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        hint={MONEY_EXAMPLE}
        error={errors.limite?.message}
        {...register('limite')}
      />

      {budget && (
        <ArchiveDeleteActions
          itemName={`orçamento de ${category.nome}`}
          disabled={isSubmitting || remove.isPending}
          onDelete={() => run(() => remove.mutateAsync(budget.id))}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || save.isPending}>
          {isSubmitting ? 'A guardar…' : 'Guardar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
