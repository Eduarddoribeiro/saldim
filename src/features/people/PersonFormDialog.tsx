import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { useCreatePerson, useDeletePerson, useUpdatePerson } from './hooks'
import type { Person } from './people-api'
import { personFormSchema, type PersonFormInput, type PersonFormValues } from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pessoa a editar; sem ela, o diálogo cria uma nova. */
  person?: Person | null
}

export function PersonFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {props.open && <PersonForm key={props.person?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function PersonForm({ onOpenChange, person }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreatePerson()
  const update = useUpdatePerson()
  const remove = useDeletePerson()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonFormInput, unknown, PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: {
      nome: person?.nome ?? '',
      dividaAnterior: centsToInput(person?.divida_anterior_centavos ?? 0),
    },
  })

  const onSubmit = handleSubmit(({ nome, dividaAnterior }) =>
    run(() =>
      person
        ? update.mutateAsync({
            id: person.id,
            patch: { nome, divida_anterior_centavos: dividaAnterior },
          })
        : create.mutateAsync({ nome, dividaAnterior }),
    ),
  )
  const busy = isSubmitting || create.isPending || update.isPending || remove.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{person ? 'Editar pessoa' : 'Nova pessoa'}</DialogTitle>
        <DialogDescription>
          Alguém que faz compras no seu cartão e te devolve o dinheiro.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <TextField
        id="pessoa-nome"
        label="Nome"
        autoComplete="off"
        maxLength={60}
        placeholder="Ex.: Mãe"
        error={errors.nome?.message}
        {...register('nome')}
      />
      <TextField
        id="pessoa-divida-anterior"
        label="Dívida anterior"
        inputMode="decimal"
        autoComplete="off"
        hint={`O que essa pessoa já te devia antes de você registrar as compras aqui (conta como já vencido). ${MONEY_EXAMPLE}`}
        error={errors.dividaAnterior?.message}
        {...register('dividaAnterior')}
      />

      {person && (
        <ArchiveDeleteActions
          itemName={person.nome}
          archived={person.arquivada}
          disabled={busy}
          deleteHint="Se já tiver compras ou pagamentos, arquive: a pessoa some das opções, mas o histórico é mantido."
          onToggleArchive={() =>
            run(() =>
              update.mutateAsync({ id: person.id, patch: { arquivada: !person.arquivada } }),
            )
          }
          onDelete={() => run(() => remove.mutateAsync(person.id))}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'Salvando…' : person ? 'Salvar' : 'Criar pessoa'}
        </Button>
      </DialogFooter>
    </form>
  )
}
