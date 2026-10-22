import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { FormAlert } from '@/components/form/FormAlert'
import { SelectField } from '@/components/form/SelectField'
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
import { invoiceMonth, shortDate } from '@/features/invoices/invoice-options'
import { useInvoices } from '@/features/invoices/hooks'
import { previewDaysChange, validateCardConfig, type CardConfig } from '@/lib/credit-card'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { isCreditCard, TIPO_CONTA_OPTIONS, TIPOS_CONTA } from './account-options'
import { accountRow, type Account } from './accounts-api'
import { cardConfig, historyFor } from './card-days'
import {
  useAccounts,
  useCardDaysHistory,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
} from './hooks'
import { accountFormSchema, type AccountFormInput, type AccountFormValues } from './schemas'

/** Dias do mês para o fechamento e o vencimento (o mês curto é tratado no cálculo das faturas). */
const DIAS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}))

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Conta a editar; sem ela, o diálogo cria uma nova. */
  account?: Account | null
}

export function AccountFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && <AccountForm key={props.account?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ onOpenChange, account }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const remove = useDeleteAccount()
  const accounts = useAccounts()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      nome: account?.nome ?? '',
      tipo: account?.tipo ?? 'corrente',
      saldoInicial: centsToInput(account?.saldo_inicial_centavos ?? 0),
      diaFechamento: account?.dia_fechamento?.toString() ?? '',
      diaVencimento: account?.dia_vencimento?.toString() ?? '',
      limite: account?.limite_centavos != null ? centsToInput(account.limite_centavos) : '',
      contaPagamentoId: account?.conta_pagamento_id ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    run(() =>
      account
        ? update.mutateAsync({ id: account.id, patch: accountRow(values) })
        : create.mutateAsync(values),
    ),
  )

  const [tipo, diaFechamento, diaVencimento] = useWatch({
    control,
    name: ['tipo', 'diaFechamento', 'diaVencimento'],
  })
  const isCard = tipo === 'cartao_credito'
  // Contas que podem pagar a fatura: de dinheiro (não cartões), não a própria, ativas — mais a atual
  const paymentOptions = (accounts.data ?? [])
    .filter((other) => !isCreditCard(other) && other.id !== account?.id)
    .filter((other) => !other.arquivada || other.id === account?.conta_pagamento_id)
    .map((other) => ({
      value: other.id,
      label: other.arquivada ? `${other.nome} (arquivada)` : other.nome,
    }))
  // Aviso (não bloqueia) para prazos pouco habituais entre fechamento e vencimento
  const prazoWarning =
    isCard && diaFechamento !== '' && diaVencimento !== ''
      ? validateCardConfig({
          diaFechamento: Number(diaFechamento),
          diaVencimento: Number(diaVencimento),
          limiteCentavos: 1,
        }).warnings[0]?.message
      : undefined

  const daysChange = useDaysChangeNotice(
    account,
    isCard && diaFechamento !== '' && diaVencimento !== ''
      ? { diaFechamento: Number(diaFechamento), diaVencimento: Number(diaVencimento) }
      : null,
  )

  const busy = isSubmitting || update.isPending || remove.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{account ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        <DialogDescription>
          Onde o seu dinheiro está (banco, poupança, carteira) ou um cartão de crédito.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <TextField
        id="conta-nome"
        label="Nome"
        autoComplete="off"
        maxLength={40}
        placeholder="Ex.: Banco, Carteira"
        error={errors.nome?.message}
        {...register('nome')}
      />
      <SelectField
        id="conta-tipo"
        label="Tipo"
        options={TIPOS_CONTA.map((tipo) => ({
          value: tipo,
          label: TIPO_CONTA_OPTIONS[tipo].label,
        }))}
        error={errors.tipo?.message}
        {...register('tipo')}
      />
      {isCard ? (
        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm text-muted-foreground">
            O fechamento e o vencimento servem para calcular as faturas. Um cartão começa sem
            dívida.
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              id="conta-dia-fechamento"
              label="Dia de fechamento"
              placeholder="Escolha"
              options={DIAS}
              error={errors.diaFechamento?.message}
              {...register('diaFechamento')}
            />
            <SelectField
              id="conta-dia-vencimento"
              label="Dia de vencimento"
              placeholder="Escolha"
              options={DIAS}
              error={errors.diaVencimento?.message}
              {...register('diaVencimento')}
            />
          </div>
          {prazoWarning && (
            <p role="status" className="-mt-2 text-xs text-muted-foreground">
              {prazoWarning}
            </p>
          )}
          {daysChange && (
            <p role="status" className="-mt-2 rounded-lg bg-muted p-3 text-xs">
              {daysChange}
            </p>
          )}
          <TextField
            id="conta-limite"
            label="Limite de crédito"
            inputMode="decimal"
            autoComplete="off"
            hint={MONEY_EXAMPLE}
            error={errors.limite?.message}
            {...register('limite')}
          />
          <SelectField
            id="conta-pagamento"
            label="Conta de pagamento"
            placeholder="Escolha a conta"
            options={paymentOptions}
            error={errors.contaPagamentoId?.message}
            {...register('contaPagamentoId')}
          />
        </fieldset>
      ) : (
        <TextField
          id="conta-saldo-inicial"
          label="Saldo inicial"
          inputMode="decimal"
          autoComplete="off"
          hint={`Quanto a conta tinha quando você começou a usar o Saldim. Pode ser negativo. ${MONEY_EXAMPLE}`}
          error={errors.saldoInicial?.message}
          {...register('saldoInicial')}
        />
      )}

      {account && (
        <ArchiveDeleteActions
          itemName={account.nome}
          archived={account.arquivada}
          disabled={busy}
          deleteHint="Se a conta já tiver transações, arquive em vez de excluir."
          onToggleArchive={() =>
            run(() =>
              update.mutateAsync({ id: account.id, patch: { arquivada: !account.arquivada } }),
            )
          }
          onDelete={() => run(() => remove.mutateAsync(account.id))}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'Salvando…' : account ? 'Salvar' : 'Criar conta'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Ao mudar os dias de um cartão que já tem faturas (C8, D14): explica, antes de guardar, a partir de
 * que fatura valem os dias novos — ou porque é que a mudança vai ser recusada. Mesmo cálculo da base
 * de dados (previewDaysChange); a base de dados volta a verificar tudo.
 */
function useDaysChangeNotice(account: Account | null | undefined, novos: CardConfig | null) {
  const atuais = cardConfig(account ?? undefined)
  // Só ao editar um cartão: nos outros casos, nada a pedir
  const invoices = useInvoices({ enabled: atuais !== null })
  const history = useCardDaysHistory({ enabled: atuais !== null })
  if (!account || !atuais || !novos || !validateCardConfig({ ...novos, limiteCentavos: 1 }).ok) {
    return null
  }
  if (
    novos.diaFechamento === atuais.diaFechamento &&
    novos.diaVencimento === atuais.diaVencimento
  ) {
    return null
  }
  // Sem faturas, os dias mudam livremente (não há nada a recalcular)
  if (!invoices.data?.some((invoice) => invoice.account_id === account.id) || !history.data) {
    return null
  }
  const preview = previewDaysChange(atuais, historyFor(history.data, account.id), novos, todayIso())
  const mes = invoiceMonth(`${preview.mesReferencia}-01`).toLowerCase()
  return preview.ok
    ? `Os dias novos valem a partir da fatura de ${mes}, que passa a fechar em ${shortDate(preview.novas.fechamento)} e a vencer em ${shortDate(preview.novas.vencimento)} (com compras desde ${shortDate(preview.novas.inicioCiclo)}). As faturas já fechadas não mudam.`
    : `Com estes dias, a fatura aberta (${mes}) fecharia em ${shortDate(preview.fechamento)}, que já passou. Escolha outros dias ou espere essa fatura fechar.`
}
