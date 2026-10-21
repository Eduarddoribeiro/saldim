import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { FullScreenLoader } from '@/components/layout/FullScreenLoader'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'
import { PASSWORD_MIN, resetPasswordSchema, type ResetPasswordValues } from './schemas'

/**
 * Destino do link de recuperação. O supabase-js lê o token do endereço e abre uma sessão
 * temporária; sem sessão, o link era inválido ou expirou.
 */
export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) })

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null)
    const { error } = await updatePassword(password)
    if (error) setServerError(error)
    else navigate('/', { replace: true })
  })

  if (loading) return <FullScreenLoader />

  if (!session) {
    return (
      <AuthCard title="Link inválido">
        <div className="grid gap-4">
          <FormAlert>Este link de recuperação é inválido ou já expirou.</FormAlert>
          <Link to="/recuperar-senha" className="text-sm font-medium underline underline-offset-4">
            Pedir um novo link
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nova senha" description="Escolha uma nova senha para sua conta.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <TextField
          id="password"
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          id="confirmPassword"
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthCard>
  )
}
