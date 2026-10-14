import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'
import { AuthCard } from './AuthCard'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const { signIn } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  // Não é preciso navegar: ao entrar, a sessão muda e <PublicOnly> redireciona para a app.
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    const { error } = await signIn(email, password)
    if (error) setServerError(error)
  })

  return (
    <AuthCard
      title="Entrar"
      description="Acede às tuas finanças."
      footer={
        <p>
          Ainda não tens conta?{' '}
          <Link to="/registar" className="font-medium text-foreground underline underline-offset-4">
            Criar conta
          </Link>
        </p>
      }
    >
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
        <div className="grid gap-1">
          <TextField
            id="password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Link
            to="/recuperar-senha"
            className="justify-self-end text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Esqueci-me da senha
          </Link>
        </div>
        <Button type="submit" size="lg" className="h-10" disabled={isSubmitting}>
          {isSubmitting ? 'A entrar…' : 'Entrar'}
        </Button>
      </form>
    </AuthCard>
  )
}
