import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'
import { PASSWORD_MIN, signUpSchema, type SignUpValues } from './schemas'

export function SignUpPage() {
  const { signUp } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) })

  const onSubmit = handleSubmit(async ({ nome, email, password }) => {
    setServerError(null)
    const { error, needsConfirmation } = await signUp(nome, email, password)
    if (error) setServerError(error)
    else if (needsConfirmation) setConfirmationSentTo(email)
    // Sem confirmação obrigatória a sessão abre logo e <PublicOnly> leva para a app.
  })

  const footer = (
    <p>
      Já tens conta?{' '}
      <Link to="/entrar" className="font-medium text-foreground underline underline-offset-4">
        Entrar
      </Link>
    </p>
  )

  if (confirmationSentTo) {
    return (
      <AuthCard title="Confirma o teu e-mail" footer={footer}>
        <FormAlert variant="success">
          Enviámos um link de confirmação para <strong>{confirmationSentTo}</strong>. Abre-o para
          ativar a conta.
        </FormAlert>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Criar conta"
      description="Começa a controlar as tuas finanças."
      footer={footer}
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {serverError && <FormAlert>{serverError}</FormAlert>}
        <TextField
          id="nome"
          label="Nome"
          autoComplete="name"
          error={errors.nome?.message}
          {...register('nome')}
        />
        <TextField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          id="password"
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint={`Pelo menos ${PASSWORD_MIN} caracteres.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <TextField
          id="confirmPassword"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? 'A criar conta…' : 'Criar conta'}
        </Button>
      </form>
    </AuthCard>
  )
}
