import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryPatch,
} from './categories-api'
import type { CategoryFormValues } from './schemas'

// A chave inclui o id do utilizador: mesmo que o cache sobrevivesse a uma troca de conta,
// os dados de uma pessoa nunca seriam servidos a outra.
export const categoriesKey = (userId: string | undefined) => ['categories', userId] as const

export function useCategories() {
  const { user } = useAuth()
  return useQuery({
    queryKey: categoriesKey(user?.id),
    queryFn: listCategories,
    enabled: Boolean(user),
  })
}

/** Depois de qualquer alteração, volta a pedir a lista ao servidor (fonte de verdade). */
function useInvalidateCategories() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoriesKey(user?.id) })
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (values: CategoryFormValues) => createCategory(values),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CategoryPatch }) => updateCategory(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategories()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: invalidate,
  })
}
