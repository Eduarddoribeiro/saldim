import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

/**
 * Ações de um registo existente: arquivar/reativar e apagar (com confirmação).
 * Arquivar esconde sem perder histórico; apagar é definitivo e a base recusa-o se o registo estiver em uso.
 */
export function ArchiveDeleteActions({
  itemName,
  archived,
  disabled,
  deleteHint,
  onToggleArchive,
  onDelete,
}: {
  itemName: string
  archived?: boolean
  disabled?: boolean
  /** Explicação extra no diálogo de confirmação (ex.: "Se já tiver transações, arquiva-a."). */
  deleteHint?: string
  /** Sem esta função não há botão de arquivar (ex.: transações só se apagam). */
  onToggleArchive?: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      {onToggleArchive && (
        <Button type="button" variant="outline" disabled={disabled} onClick={onToggleArchive}>
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? 'Reativar' : 'Arquivar'}
        </Button>
      )}
      <Button
        type="button"
        variant="destructive"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden />
        Excluir
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{itemName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.{deleteHint ? ` ${deleteHint}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                onDelete()
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
