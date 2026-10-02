'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, controlClass } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, errorMessage, unwrap } from '@/lib/api'
import { describePaymentMethod, PAYMENT_METHOD_LABEL, type PaymentMethodType } from '@/lib/worker-view'
import type { WorkerRecord } from './worker-form'

// readOnly (management): sees the payment methods, without adding, removing or changing the primary one.
export function PaymentMethods({ worker, readOnly = false }: { worker: WorkerRecord; readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<PaymentMethodType>('yape')
  const id = worker.id

  // Returns the promise: the mutation stays "pending" until the list is refreshed.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workers', id] })
  const options = {
    onSuccess: refresh,
    onError: (e: unknown) => {
      toast.error(errorMessage(e))
    },
  }
  const add = useMutation({
    mutationFn: (formData: FormData) => {
      const text = (field: string) => String(formData.get(field) ?? '').trim()
      return unwrap(
        api.v1.workers[':id']['payment-methods'].$post({
          param: { id },
          json: {
            type,
            number: text('number'),
            holderName: text('holderName'),
            bank: text('bank') || null,
            cci: text('cci') || null,
          },
        }),
      )
    },
    ...options,
    onSuccess: () => {
      setAdding(false)
      return refresh()
    },
  })
  const makePrimary = useMutation({
    mutationFn: (methodId: string) =>
      unwrap(api.v1.workers[':id']['payment-methods'][':methodId'].$patch({ param: { id, methodId }, json: { isPrimary: true } })),
    ...options,
  })
  const remove = useMutation({
    mutationFn: (methodId: string) =>
      unwrap(api.v1.workers[':id']['payment-methods'][':methodId'].$delete({ param: { id, methodId } })),
    ...options,
  })
  const busy = remove.isPending || makePrimary.isPending || add.isPending

  function confirmRemove(method: (typeof worker.paymentMethods)[number]) {
    if (window.confirm(`¿Quitar ${describePaymentMethod(method)}? Se borrarán sus datos.`)) remove.mutate(method.id)
  }

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Métodos de pago</h2>
        {!readOnly && <span className="text-xs text-muted-foreground">Opcional</span>}
      </div>

      {worker.paymentMethods.length === 0 && <p className="text-sm text-muted-foreground">Aún no tiene métodos de pago.</p>}
      <ul className="space-y-2">
        {worker.paymentMethods.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {PAYMENT_METHOD_LABEL[m.type]} · {m.bank ? `${m.bank} ` : ''}
                {m.number} {m.isPrimary && <Badge variant="secondary">Principal</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.cci ? `CCI ${m.cci} · ` : ''}Titular: {m.holderName}
              </p>
            </div>
            {!readOnly && !m.isPrimary && (
              <Button
                variant="ghost"
                size="lg"
                aria-label={`Hacer principal ${describePaymentMethod(m)}`}
                disabled={busy}
                onClick={() => makePrimary.mutate(m.id)}
              >
                Hacer principal
              </Button>
            )}
            {!readOnly && (
              <Button variant="destructive" size="lg" aria-label={`Quitar ${describePaymentMethod(m)}`} disabled={busy} onClick={() => confirmRemove(m)}>
                Quitar
              </Button>
            )}
          </li>
        ))}
      </ul>

      {readOnly ? null : adding ? (
        <form
          className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            add.mutate(new FormData(e.currentTarget))
          }}
        >
          <Field id="method-type" label="Tipo">
            <select id="method-type" className={`${controlClass} h-10`} value={type} onChange={(e) => setType(e.target.value as PaymentMethodType)}>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethodType[]).map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_METHOD_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="method-number" label={type === 'bank_account' ? 'Número de cuenta' : 'Celular'}>
            <Input
              id="method-number"
              name="number"
              required
              minLength={6}
              maxLength={30}
              inputMode={type === 'bank_account' ? undefined : 'numeric'}
              className="h-10"
            />
          </Field>
          {type === 'bank_account' && (
            <>
              <Field id="method-bank" label="Banco">
                <Input id="method-bank" name="bank" maxLength={40} className="h-10" />
              </Field>
              <Field id="method-cci" label="CCI">
                <Input id="method-cci" name="cci" maxLength={30} className="h-10" />
              </Field>
            </>
          )}
          <Field id="method-holder" label="Titular" help="Puede ser otra persona." className="sm:col-span-2">
            <Input id="method-holder" name="holderName" required minLength={2} maxLength={80} defaultValue={`${worker.firstName} ${worker.lastName}`} className="h-10" />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="lg" disabled={add.isPending}>
              Agregar
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        // The label is long: it must wrap on a phone. A button that cannot shrink widens the whole page and pushes
        // the bottom menu off the screen.
        <Button
          variant="outline"
          size="lg"
          className="h-auto min-h-9 w-full shrink border-dashed py-2 whitespace-normal"
          onClick={() => setAdding(true)}
        >
          + Agregar método de pago (Yape, Plin o cuenta bancaria)
        </Button>
      )}
    </section>
  )
}
