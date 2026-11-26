import { Check, Copy, Send } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { SheetContent } from '@/components/layout/SheetContent'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Person } from '@/features/people/people-api'
import { useProfile, useUpdatePixKey, useUpdateProfileName } from '@/features/profile/hooks'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import { useCreateInvite, useStopSharing } from './hooks'

type Props = { open: boolean; onOpenChange: (open: boolean) => void; person: Person | null }

/**
 * Compartilhar com a pessoa o que ela deve: gera um link de convite (vale 7 dias, uso único) para
 * enviar pelo WhatsApp. Se ela já está ligada, mostra-o e permite deixar de compartilhar.
 */
export function ShareDebtDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent>
        {props.open && props.person && (
          <ShareDebt key={props.person.id} {...props} person={props.person} />
        )}
      </SheetContent>
    </Dialog>
  )
}

function ShareDebt({ person, onOpenChange }: Props & { person: Person }) {
  const profile = useProfile()
  const updateName = useUpdateProfileName()
  const create = useCreateInvite()
  const stop = useStopSharing()
  const [name, setName] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shownName = name ?? profile.data?.nome ?? ''

  if (person.viewer_id) {
    return (
      <div className="grid gap-5 pb-2">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Compartilhado com {person.nome}
          </DialogTitle>
          <DialogDescription>
            {person.nome} já vê o que deve na conta dela, sempre atualizado: compras, meses e
            pagamentos. Ela não vê mais nada seu.
          </DialogDescription>
        </DialogHeader>
        {error && <FormAlert>{error}</FormAlert>}
        <PixKeyField person={person.nome} />
        <Button
          variant="outline"
          size="lg"
          className="h-12 rounded-full text-destructive"
          disabled={stop.isPending}
          onClick={() =>
            stop.mutate(person.id, {
              onSuccess: () => onOpenChange(false),
              onError: (cause) => setError(errorMessage(cause)),
            })
          }
        >
          Deixar de compartilhar
        </Button>
      </div>
    )
  }

  const generate = async () => {
    setError(null)
    try {
      const trimmed = shownName.trim()
      if (trimmed !== (profile.data?.nome ?? '')) await updateName.mutateAsync(trimmed)
      const token = await create.mutateAsync(person.id)
      setLink(`${window.location.origin}/convite/${token}`)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const message = link
    ? `Oi! Aqui você vê tudo o que comprou no meu cartão e quanto falta pagar, mês a mês: ${link}`
    : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link ?? '')
      setCopied(true)
    } catch {
      setError('Não foi possível copiar. Toque no link e copie à mão.')
    }
  }

  return (
    <div className="grid gap-5 pb-2">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Compartilhar com {person.nome}</DialogTitle>
        <DialogDescription>
          {person.nome} cria uma conta no Saldim e vê no celular dela o que deve, mês a mês, e o que
          já pagou. Ela só vê as compras dela.
        </DialogDescription>
      </DialogHeader>
      {error && <FormAlert>{error}</FormAlert>}

      {link ? (
        <>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Envie este link para {person.nome}:</p>
            <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm break-all select-all">
              {link}
            </p>
            <p className="text-xs text-muted-foreground">
              Vale 7 dias e só funciona uma vez. Gerar outro cancela este.
            </p>
          </div>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: 'lg' }), 'h-12 w-full rounded-full text-base')}
          >
            <Send aria-hidden />
            Enviar pelo WhatsApp
          </a>
          <Button variant="outline" size="lg" className="h-12 rounded-full" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Link copiado' : 'Copiar link'}
          </Button>
        </>
      ) : (
        <>
          <TextField
            id="partilha-nome"
            label="Seu nome"
            hint={`É assim que ${person.nome} vai te ver: “Você deve a …”.`}
            autoComplete="given-name"
            maxLength={80}
            value={shownName}
            onChange={(event) => setName(event.target.value)}
          />
          <PixKeyField person={person.nome} />
          <Button
            size="lg"
            className="h-12 rounded-full text-base"
            disabled={create.isPending || updateName.isPending}
            onClick={() => void generate()}
          >
            {create.isPending ? 'Gerando…' : 'Gerar link'}
          </Button>
        </>
      )}
    </div>
  )
}

/**
 * A sua chave Pix (opcional): aparece para quem deve com um botão "Copiar chave Pix". Guarda-se no
 * perfil, por isso vale para todas as pessoas com quem compartilha.
 */
function PixKeyField({ person }: { person: string }) {
  const profile = useProfile()
  const save = useUpdatePixKey()
  const saved = profile.data?.chave_pix ?? ''
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = value ?? saved
  const changed = shown.trim() !== saved
  return (
    <div className="grid gap-2">
      <TextField
        id="partilha-pix"
        label="Sua chave Pix (opcional)"
        hint={`${person} vê um botão para copiar e pagar. Celular, e-mail, CPF ou chave aleatória.`}
        autoComplete="off"
        maxLength={120}
        value={shown}
        error={error ?? undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      {changed && (
        <Button
          variant="outline"
          className="w-fit rounded-full"
          disabled={save.isPending}
          onClick={() => {
            setError(null)
            save.mutate(shown.trim() || null, {
              onSuccess: () => setValue(null),
              onError: (cause) => setError(errorMessage(cause)),
            })
          }}
        >
          {save.isPending ? 'Salvando…' : 'Salvar chave Pix'}
        </Button>
      )}
    </div>
  )
}
