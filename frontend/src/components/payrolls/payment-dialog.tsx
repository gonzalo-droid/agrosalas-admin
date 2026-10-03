'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { workerName } from '@/components/attendance/record-dialog'
import { Field, controlClass } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiClientError, api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { compressImage } from '@/lib/compress-image'
import { EVIDENCE_ACCEPT, evidenceProblem, isEvidenceType, isImage } from '@/lib/evidence'
import { limaDate } from '@/lib/lima-time'
import { centsToInput, parseSolesToCents, pendingText, proposedPaymentCents } from '@/lib/money'
import { defaultPayOption, invalidateMoney, paymentBody, payOptions, type PayOption } from '@/lib/payments'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>

const DETAIL_MAX = 160
const NOTE_MAX = 300
// The fields of the form that have a place under them for the API's error.
const FORM_FIELDS = ['amountCents', 'date', 'method', 'paymentMethodId', 'methodDetail', 'evidencePath', 'note']
const AMOUNT_ERROR = 'Escribe un monto válido, por ejemplo 68.23'
const UPLOAD_ERROR = 'No se pudo subir la evidencia. Inténtalo de nuevo.'
// The request of the payment was sent but its answer never came: it may or may not have been saved.
const PAYMENT_UNKNOWN_CODE = 'payment_unknown'
const PAYMENT_UNKNOWN_ERROR = 'No se sabe si el pago se registró. Revisa la lista de Pagos antes de volver a intentarlo.'

type Values = { amount: string; date: string; optionKey: string; detail: string; note: string; evidence: File | null }
type FormError = { field?: string; message: string }
type PaymentInput = { amountCents: number; date: string; option: PayOption; detail: string; note: string; file: File | null }

// The file goes straight to the signed URL of the bucket, not through the API: the answer of that request is not the
// API's, so its failure is mapped here to one message.
async function uploadEvidence(payrollId: string, workerId: string, file: File): Promise<string> {
  // A file that got here passed evidenceProblem; the guard also narrows its type for the client.
  if (!isEvidenceType(file.type)) throw new ApiClientError({ code: 'validation', message: evidenceProblem(file) ?? UPLOAD_ERROR })
  const { path, signedUrl } = await unwrap(
    api.v1.evidence['upload-url'].$post({ json: { payrollId, workerId, contentType: file.type, sizeBytes: file.size } }),
  )
  const failed = () => new ApiClientError({ code: 'upload_failed', message: UPLOAD_ERROR })
  let response: Response
  try {
    response = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  } catch {
    throw failed()
  }
  if (!response.ok) throw failed()
  return path
}

// Registers a payment of a worker of the payroll, with an optional evidence (a photo is reduced before it is uploaded).
export function PaymentDialog({
  payroll,
  workerId,
  open,
  onOpenChange,
}: {
  payroll: Payroll
  workerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const today = limaDate(new Date())

  // Same key and function as the balances of the tab: the cached answer is the one the "Pagar" button came from.
  const balances = useQuery({
    queryKey: ['payrolls', payroll.id, 'balances'],
    queryFn: () => unwrap(api.v1.payrolls[':id'].balances.$get({ param: { id: payroll.id } })),
    enabled: open,
  })
  const worker = useQuery({
    queryKey: ['workers', workerId],
    queryFn: () => unwrap(api.v1.workers[':id'].$get({ param: { id: workerId } })),
    enabled: open,
  })
  const pendingCents = balances.data?.items.find((b) => b.workerId === workerId)?.pendingCents
  const methodsLoading = worker.isPending
  const options = payOptions(worker.data?.paymentMethods ?? [])

  // The form is rebuilt every time the dialog opens: the pending amount proposed, today, the first method.
  const proposed = pendingCents === undefined ? 0 : proposedPaymentCents(pendingCents)
  const stored: Values = { amount: proposed > 0 ? centsToInput(proposed) : '', date: today, optionKey: '', detail: '', note: '', evidence: null }
  const [form, setForm] = useState<Values | null>(null)
  const [error, setError] = useState<FormError | null>(null)
  const [preparing, setPreparing] = useState(false)
  // A photo takes a moment to reduce: only the last choice counts, and opening or closing the dialog drops the pending one.
  const choice = useRef(0)
  useEffect(() => {
    choice.current++
  }, [open])
  // Choosing the same file again fires no change event, so a rejected or removed file resets the input with a new key.
  const [inputKey, setInputKey] = useState(0)

  if (open && !form) setForm(stored)
  if (!open && form) {
    setForm(null)
    setError(null)
    setPreparing(false)
  }
  const values = form ?? stored
  const edit = (field: 'amount' | 'date' | 'optionKey' | 'detail' | 'note') => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => f && { ...f, [field]: e.target.value })

  // Until a method is chosen, the default one follows the methods as they load.
  const selected = options.find((o) => o.key === (values.optionKey || defaultPayOption(options))) ?? options[0]

  // True from the moment a submit starts until its mutation settles: a second tap or Enter before the button is
  // disabled by the re-render must not send a second payment.
  const inFlight = useRef(false)

  // One mutation for the whole submit: the upload and the payment. A payment is never retried by itself.
  const save = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: async ({ file, ...input }: PaymentInput) => {
      const evidencePath = file ? await uploadEvidence(payroll.id, workerId, file) : null
      try {
        return await unwrap(api.v1.payments.$post({ json: paymentBody({ ...input, payrollId: payroll.id, workerId, evidencePath }) }))
      } catch (e) {
        // Only the payment step: a lost answer of the upload is just a failed upload.
        if (e instanceof ApiClientError && e.code === 'network_error') {
          throw new ApiClientError({ code: PAYMENT_UNKNOWN_CODE, message: PAYMENT_UNKNOWN_ERROR })
        }
        throw e
      }
    },
    onSuccess: () => {
      invalidateMoney(queryClient)
      toast.success('Pago registrado')
      onOpenChange(false)
    },
    onError: (e) => {
      // The payment may have been saved: the lists must show it if so.
      if (e instanceof ApiClientError && e.code === PAYMENT_UNKNOWN_CODE) invalidateMoney(queryClient)
      setError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })

  const clearEvidenceError = () => setError((current) => (current?.field === 'evidencePath' ? null : current))

  async function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const mine = ++choice.current
    clearEvidenceError()
    if (!file) {
      // A pending reduction was dropped by the new choice above: nothing is being prepared any more.
      setPreparing(false)
      return setForm((f) => f && { ...f, evidence: null })
    }
    setPreparing(true)
    const ready = isImage(file.type) ? await compressImage(file) : file
    if (mine !== choice.current) return
    setPreparing(false)
    const problem = evidenceProblem(ready)
    if (problem) {
      setInputKey((k) => k + 1)
      setError({ field: 'evidencePath', message: problem })
      return setForm((f) => f && { ...f, evidence: null })
    }
    setForm((f) => f && { ...f, evidence: ready })
  }

  function removeFile() {
    choice.current++
    setInputKey((k) => k + 1)
    clearEvidenceError()
    setPreparing(false)
    setForm((f) => f && { ...f, evidence: null })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    setError(null)
    // parseSolesToCents reads "0" as 0: a payment of nothing is not an amount either.
    const amountCents = parseSolesToCents(values.amount)
    if (!amountCents) return setError({ field: 'amountCents', message: AMOUNT_ERROR })
    inFlight.current = true
    save.mutate({ amountCents, date: values.date, option: selected, detail: values.detail, note: values.note, file: values.evidence })
  }

  const errorFor = (...fields: string[]) => (error?.field && fields.includes(error.field) ? error.message : undefined)
  const member = payroll.workers.find((w) => w.id === workerId)
  const busy = save.isPending

  return (
    // While saving, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago a {member ? workerName(member) : 'trabajador'}</DialogTitle>
          <p className="text-sm text-muted-foreground">Pendiente: {pendingCents === undefined ? '…' : pendingText(pendingCents)}</p>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="payment-amount" label="Monto (S/)" error={errorFor('amountCents')}>
              <Input id="payment-amount" className="h-10" inputMode="decimal" autoComplete="off" disabled={busy} value={values.amount} onChange={edit('amount')} />
            </Field>
            <Field id="payment-date" label="Fecha" error={errorFor('date')}>
              <Input id="payment-date" type="date" className="h-10" required max={today} disabled={busy} value={values.date} onChange={edit('date')} />
            </Field>
          </div>
          <Field id="payment-method" label="Medio" error={errorFor('method', 'paymentMethodId')}>
            <select
              id="payment-method"
              className={`${controlClass} h-10`}
              disabled={busy || methodsLoading}
              value={methodsLoading ? '' : selected.key}
              onChange={edit('optionKey')}
            >
              {methodsLoading ? (
                <option value="">Cargando métodos…</option>
              ) : (
                options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          </Field>
          {worker.error && !worker.data && (
            <p role="alert" className="text-xs text-destructive">
              No se pudieron cargar los métodos registrados del trabajador. Puedes elegir otro medio.
            </p>
          )}
          {!methodsLoading && selected.needsDetail && (
            <Field id="payment-detail" label="Número y titular" error={errorFor('methodDetail')}>
              <Input id="payment-detail" className="h-10" maxLength={DETAIL_MAX} disabled={busy} value={values.detail} onChange={edit('detail')} />
            </Field>
          )}
          <Field
            id="payment-evidence"
            label="Evidencia (opcional)"
            help="JPG, PNG, WebP o PDF de hasta 5 MB. Las fotos se reducen antes de subir."
            error={errorFor('evidencePath')}
          >
            <Input
              key={inputKey}
              id="payment-evidence"
              type="file"
              accept={EVIDENCE_ACCEPT}
              className="h-10 py-1.5"
              disabled={busy}
              onChange={(e) => void chooseFile(e)}
            />
          </Field>
          {preparing && <p className="text-xs text-muted-foreground">Preparando el archivo…</p>}
          {values.evidence && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">
                {values.evidence.name} · {Math.max(1, Math.round(values.evidence.size / 1024))} KB
              </span>
              <Button type="button" variant="outline" size="lg" className="h-11 shrink-0" disabled={busy} onClick={removeFile}>
                Quitar
              </Button>
            </div>
          )}
          <Field id="payment-note" label="Nota (opcional)" error={errorFor('note')}>
            <Input id="payment-note" className="h-10" maxLength={NOTE_MAX} disabled={busy} value={values.note} onChange={edit('note')} />
          </Field>

          {/* The errors of a field are shown under that field; the rest (e.g. a failed upload), here. */}
          {error && !FORM_FIELDS.includes(error.field ?? '') && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" className="h-11" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" className="h-11" disabled={busy || preparing || methodsLoading}>
              {busy ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
