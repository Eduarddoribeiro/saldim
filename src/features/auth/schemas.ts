import { z } from 'zod'

// Regras dos formulários de autenticação. O servidor volta a validar (ex.: senha mínima 8 em config.toml).

export const PASSWORD_MIN = 8
// O Supabase (bcrypt) ignora tudo depois de 72 bytes: recusamos para não criar uma falsa sensação de segurança.
export const PASSWORD_MAX = 72

const email = z
  .string()
  .trim()
  .min(1, { error: 'Indica o teu e-mail.' })
  .pipe(z.email({ error: 'E-mail inválido.' }))

const newPassword = z
  .string()
  .min(PASSWORD_MIN, { error: `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.` })
  .max(PASSWORD_MAX, { error: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.` })

const passwordsMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword

const mismatch = { error: 'As senhas não coincidem.', path: ['confirmPassword'] }

export const loginSchema = z.object({
  email,
  // No login não aplicamos o mínimo: quem tem uma senha antiga mais curta tem de conseguir entrar.
  password: z.string().min(1, { error: 'Indica a senha.' }),
})

export const signUpSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, { error: 'Indica o teu nome.' })
      .max(80, { error: 'O nome pode ter no máximo 80 caracteres.' }),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, mismatch)

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine(passwordsMatch, mismatch)

export type LoginValues = z.infer<typeof loginSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
