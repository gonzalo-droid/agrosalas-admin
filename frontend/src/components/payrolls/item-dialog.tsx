'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { workerName } from '@/components/attendance/record-dialog'
import { Field, controlClass } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiClientError, api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { centsToInput } from '@/lib/money'
import { itemAmountCents, itemChanges } from '@/lib/payroll-detail'
import { ITEM_TYPE_LABEL, invalidateMoney, type ItemType } from '@/lib/payments'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>
export type PayrollItem = ResponseBody<(typeof api.v1)['payroll-items']['$get']>['items'][number]

const NOTE_MAX = 300
const ITEM_TYPES = Object.keys(ITEM_TYPE_LABEL) as ItemType[]
// The fields of the form that have a place under them for the API's error.
const FORM_FIELDS = ['workerId', 'type', 'amountCents', 'note']
const AMOUNT_ERROR = 'Escribe un monto válido, por ejemplo 68.23'

type Values = { workerId: string; type: ItemType; amount: string; note: string }

// Adds a payroll item (item = null) or edits the amount and the note of one. A closed payroll never opens it.
export function ItemDialog({
  payroll,
  item,
  open,
  onOpenChange,
}: {
  payroll: Payroll
  item: PayrollItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  // The form is rebuilt every time the dialog opens: from the stored item, or empty (a bonus by default).
  const stored: Values = item
    ? { workerId: item.workerId, type: item.type, amount: centsToInput(item.amountCents), note: item.note ?? '' }
    : { workerId: '', type: 'bonus', amount: '', note: '' }
  const [form, setForm] = useState<Values | null>(null)
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)

  if (open && !form) setForm(stored)
  if (!open && form) {
    setForm(null)
    setError(null)
  }
  const values = form ?? stored
  const edit = (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => f && { ...f, [field]: e.target.value })

  // Each request is built where its body is known, so the client checks its types.
  const save = useMutation({
    mutationFn: (send: () => Promise<unknown>) => send(),
    onSuccess: () => {
      invalidateMoney(queryClient)
      toast.success(item ? 'Concepto actualizado' : 'Concepto agregado')
      onOpenChange(false)
    },
    onError: (e) => setError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) }),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountCents = itemAmountCents(values.amount)
    if (amountCents === null) return setError({ field: 'amountCents', message: AMOUNT_ERROR })
    if (!item) {
      const note = values.note.trim() || null
      return save.mutate(() =>
        unwrap(api.v1['payroll-items'].$post({ json: { payrollId: payroll.id, workerId: values.workerId, type: values.type, amountCents, note } })),
      )
    }
    const changes = itemChanges(item, { amountCents, note: values.note })
    // Nothing changed: the API would refuse an empty body, and there is nothing to save.
    if (Object.keys(changes).length === 0) return onOpenChange(false)
    save.mutate(() => unwrap(api.v1['payroll-items'][':id'].$patch({ param: { id: item.id }, json: changes })))
  }

  const errorFor = (field: string) => (error?.field === field ? error.message : undefined)
  const member = item ? payroll.workers.find((w) => w.id === item.workerId) : undefined

  return (
    // While saving, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar concepto' : 'Agregar concepto'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {item ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Trabajador</dt>
              <dd className="font-medium break-words">{member ? workerName(member) : '–'}</dd>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="font-medium">{ITEM_TYPE_LABEL[item.type]}</dd>
            </dl>
          ) : (
            <>
              <Field id="item-worker" label="Trabajador" error={errorFor('workerId')}>
                <select id="item-worker" className={`${controlClass} h-10`} required value={values.workerId} onChange={edit('workerId')}>
                  <option value="">Elige un trabajador</option>
                  {payroll.workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {workerName(w)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="item-type" label="Tipo" error={errorFor('type')}>
                <select id="item-type" className={`${controlClass} h-10`} value={values.type} onChange={edit('type')}>
                  {ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ITEM_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field id="item-amount" label="Monto (S/)" help="Un descuento se escribe en positivo: resta por su tipo." error={errorFor('amountCents')}>
            <Input id="item-amount" className="h-10" inputMode="decimal" autoComplete="off" value={values.amount} onChange={edit('amount')} />
          </Field>
          <Field id="item-note" label="Nota (opcional)" error={errorFor('note')}>
            <Input id="item-note" className="h-10" maxLength={NOTE_MAX} value={values.note} onChange={edit('note')} />
          </Field>

          {/* The errors of a field are shown under that field; the rest, here. */}
          {error && !FORM_FIELDS.includes(error.field ?? '') && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="h-11" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" className="h-11" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : item ? 'Guardar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
