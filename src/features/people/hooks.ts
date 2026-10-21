import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  createPerson,
  createReimbursement,
  deletePerson,
  deleteReimbursement,
  listPeople,
  listReimbursements,
  updatePerson,
  type PersonPatch,
  type ReimbursementValues,
} from './people-api'

export const peopleKey = (userId: string | undefined) => ['people', userId] as const
export const reimbursementsKey = (userId: string | undefined) => ['reimbursements', userId] as const

export function usePeople() {
  const { user } = useAuth()
  return useQuery({ queryKey: peopleKey(user?.id), queryFn: listPeople, enabled: Boolean(user) })
}

/** Reembolsos: mexem no que cada pessoa deve e nos saldos do Início. */
export function useReimbursements() {
  const { user } = useAuth()
  return useQuery({
    queryKey: reimbursementsKey(user?.id),
    queryFn: listReimbursements,
    enabled: Boolean(user),
  })
}

function useInvalidate(key: (userId: string | undefined) => readonly unknown[]) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: key(user?.id) })
}

export function useCreatePerson() {
  const invalidate = useInvalidate(peopleKey)
  return useMutation({
    mutationFn: (values: string | { nome: string; dividaAnterior: number }) =>
      typeof values === 'string'
        ? createPerson(values)
        : createPerson(values.nome, values.dividaAnterior),
    onSuccess: invalidate,
  })
}

export function useUpdatePerson() {
  const invalidate = useInvalidate(peopleKey)
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PersonPatch }) => updatePerson(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeletePerson() {
  const invalidate = useInvalidate(peopleKey)
  return useMutation({ mutationFn: (id: string) => deletePerson(id), onSuccess: invalidate })
}

export function useCreateReimbursement() {
  const invalidate = useInvalidate(reimbursementsKey)
  return useMutation({
    mutationFn: (values: ReimbursementValues) => createReimbursement(values),
    onSuccess: invalidate,
  })
}

export function useDeleteReimbursement() {
  const invalidate = useInvalidate(reimbursementsKey)
  return useMutation({
    mutationFn: (id: string) => deleteReimbursement(id),
    onSuccess: invalidate,
  })
}
