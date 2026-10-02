'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { workerName } from '@/components/attendance/record-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiClientError, api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { closingCheck } from '@/lib/closing'
import { plural } from '@/lib/format'
import { pendingText } from '@/lib/money'
import { invalidateClosing } from '@/lib/payments'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>

const CHANGED_MESSAGE = 'Los saldos cambiaron. Revisa la lista y vuelve a confirmar.'

// Closing asks for confirmation with what is still pending: balances to pay, records to review, days with an open stretch.
export function CloseDialog({ payroll, open, onOpenChange }: { payroll: Payroll; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  // Same key and function as the balances of the tabs: when the answer is cached, the list shows at once (and refreshes).
  const balances = useQuery({
    queryKey: ['payrolls', payroll.id, 'balances'],
    queryFn: () => unwrap(api.v1.payrolls[':id'].balances.$get({ param: { id: payroll.id } })),
    enabled: open,
  })

  if (!open && error) setError(null)

  const check = balances.data ? closingCheck(balances.data.items, payroll.records) : null
  const names = new Map(payroll.workers.map((w) => [w.id, workerName(w)]))

  const close = useMutation({
    // A closing is never retried by itself.
    networkMode: 'always',
    retry: false,
    mutationFn: (confirmPending: boolean) =>
      unwrap(api.v1.payrolls[':id'].close.$post({ param: { id: payroll.id }, json: confirmPending ? { confirmPending: true } : {} })),
    onSuccess: () => {
      invalidateClosing(queryClient)
      toast.success('Planilla cerrada')
      onOpenChange(false)
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.code === 'pending_balances') {
        // What is pending changed while the dialog was open: the list is reloaded and must be confirmed again.
        void balances.refetch()
        setError(CHANGED_MESSAGE)
        return
      }
      setError(errorMessage(e))
    },
  })

  const ready = check !== null && !balances.isFetching

  function submit() {
    if (!check) return
    setError(null)
    close.mutate(check.pending.length > 0)
  }

  return (
    // While closing, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !close.isPending && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cerrar planilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Al cerrarla no se podrán registrar ni corregir asistencias, conceptos ni pagos. Solo el administrador puede reabrirla.</p>

          {balances.error && !balances.data ? (
            <p role="alert" className="text-destructive">
              {errorMessage(balances.error)}
            </p>
          ) : !check ? (
            <p className="text-muted-foreground">Revisando saldos…</p>
          ) : check.pending.length === 0 && check.needsReview === 0 && check.openStretches === 0 ? (
            <p>Todo está pagado y completo.</p>
          ) : (
            <>
              {check.pending.length > 0 && (
                <div className="space-y-1">
                  <p>Estos trabajadores tienen saldo pendiente:</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {check.pending.map((b) => (
                      <li key={b.workerId} className="break-words">
                        {names.get(b.workerId) ?? '–'}: {pendingText(b.pendingCents)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {check.needsReview > 0 && <p>{plural(check.needsReview, 'registro', 'registros')} por revisar.</p>}
              {check.openStretches > 0 && <p>{plural(check.openStretches, 'día', 'días')} con un tramo sin salida.</p>}
            </>
          )}

          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={close.isPending} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" size="lg" disabled={!ready || close.isPending} onClick={submit}>
            {close.isPending ? 'Cerrando…' : 'Cerrar planilla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
