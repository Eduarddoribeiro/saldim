import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { TextField } from '@/components/form/TextField'
import { addDays, type IsoDate } from '@/lib/dates'
import { ChoiceChips } from './ChoiceChips'

type Choice = 'hoje' | 'ontem' | 'outra'

/**
 * Data em botões "Hoje / Ontem / Outra data" (a maior parte dos lançamentos é de hoje ou de ontem);
 * "Outra data" mostra o campo de data. Abre na escolha que corresponde à data inicial.
 */
export function DateChips({
  legend = 'Data',
  name,
  fieldId,
  today,
  initial,
  setDate,
  field,
  error,
  min,
  max,
}: {
  legend?: string
  /** Nome do grupo de rádios (único na página) */
  name: string
  /** id do campo "Qual data?" */
  fieldId: string
  today: IsoDate
  initial: IsoDate
  setDate: (date: IsoDate) => void
  /** `register('data')` */
  field: UseFormRegisterReturn
  error?: string
  min?: IsoDate
  max?: IsoDate
}) {
  const yesterday = addDays(today, -1)
  const [choice, setChoice] = useState<Choice>(
    initial === today ? 'hoje' : initial === yesterday ? 'ontem' : 'outra',
  )
  const choose = (next: Choice) => {
    setChoice(next)
    if (next === 'hoje') setDate(today)
    if (next === 'ontem') setDate(yesterday)
  }

  return (
    <div className="grid gap-3">
      <ChoiceChips
        legend={legend}
        name={name}
        selected={choice}
        onChange={(event) => choose(event.target.value as Choice)}
        options={[
          { value: 'hoje', label: 'Hoje' },
          { value: 'ontem', label: 'Ontem' },
          { value: 'outra', label: 'Outra data' },
        ]}
      />
      {choice === 'outra' ? (
        <TextField
          id={fieldId}
          label="Qual data?"
          type="date"
          min={min}
          max={max}
          error={error}
          {...field}
        />
      ) : (
        error && <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
