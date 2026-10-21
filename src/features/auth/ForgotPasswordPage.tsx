import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'
import { forgotPasswordSchema, type ForgotPasswordValues } from './schemas'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null)
    const { error } = await requestPasswordReset(email)
    if (error) setServerError(error)
    else setSent(true)
  })

  return (
    <AuthCard
      title="Recuperar senha"
      description="Vamos enviar um link para você criar uma nova senha."
      footer={
        <Link to="/entrar" className="font-medium text-foreground underline underline-offset-4">
          Voltar ao login
        </Link>
      }
    >
      {sent ? (
        // Mesma mensagem exista ou não a conta: não revelamos que e-mails estão registados.
        <FormAlert variant="success">
          Se existir uma conta com esse e-mail, você vai receber um link em breve.
        </FormAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {serverError && <FormAlert>{serverError}</FormAlert>}
          <TextField
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
