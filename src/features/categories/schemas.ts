import { z } from 'zod'
import { COLOR_KEYS, ICON_KEYS } from './category-options'

export const TIPOS = ['despesa', 'receita'] as const
export type Tipo = (typeof TIPOS)[number]

export const TIPO_LABELS: Record<Tipo, { singular: string; plural: string }> = {
  despesa: { singular: 'Despesa', plural: 'Despesas' },
  receita: { singular: 'Receita', plural: 'Receitas' },
}

// Mesmos limites da base de dados (categories.nome: 1–40 caracteres, sem espaços nas pontas).
export const categoryFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Indica o nome da categoria.' })
    .max(40, { error: 'O nome pode ter no máximo 40 caracteres.' }),
  tipo: z.enum(TIPOS),
  cor: z.enum(COLOR_KEYS),
  icone: z.enum(ICON_KEYS),
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>
