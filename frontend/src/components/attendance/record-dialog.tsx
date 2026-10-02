'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, controlClass } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiClientError, api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { ATTENDANCE_TYPE_LABEL, formatMinutes, MARK_LABEL, MARKS, type AttendanceType } from '@/lib/attendance'
import { formatCents, formatDate } from '@/lib/format'
import { dayOffset } from '@/lib/lima-time'
import { buildRecordBody, formFromRecord, type RecordBody, type RecordForm } from '@/lib/record-changes'

// The record of a worker on a day, as the list of the day returns it (money is null for the coordinator).
export type DayRecord = NonNullable<ResponseBody<typeof api.v1.attendance.$get>['items'][number]['record']>

// "Lastname, Firstname": the way a worker is named on this screen.
export const workerName = (worker: { firstName: string; lastName: string }) => `${worker.lastName}, ${worker.firstName}`

type RecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payrollId: string
  date: string // 'YYYY-MM-DD'
  worker: { id: string; firstName: string; lastName: string }
  record: DayRecord | null // null = create a record for that worker and date
  canEditMoney: boolean // admin and accounting
  readOnly?: boolean // management
  onSaved: () => void // the caller invalidates its own queries
}

type FormError = { field?: string; message: string }
// What the dialog works on while it is open. It is taken when the dialog opens and never replaced while it stays open:
// a record that is reloaded behind the dialog must not change what the user is editing, nor what counts as "changed".
type Session = { loaded: DayRecord | null; form: RecordForm; error: FormError | null }

const TYPES = Object.keys(ATTENDANCE_TYPE_LABEL) as AttendanceType[]
const TIME_HELP = 'Si una hora es menor que la anterior, se toma como del día siguiente.'

export function RecordDialog({ open, onOpenChange, payrollId, date, worker, record, canEditMoney, readOnly = false, onSaved }: RecordDialogProps) {
  const [session, setSession] = useState<Session | null>(null)
  // Opening takes a fresh copy of the record; closing drops it. (Setting state while rendering is React's way of
  // resetting state when a prop changes.)
  if (open && !session) setSession({ loaded: record, form: formFromRecord(record), error: null })
  if (!open && session) setSession(null)

  const finish = (message: string) => {
    toast.success(message)
    onSaved()
    onOpenChange(false)
  }
  const fail = (e: unknown) =>
    setSession((s) => s && { ...s, error: { field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) } })

  const save = useMutation({
    mutationFn: ({ recordId, body }: { recordId: string | null; body: RecordBody }) =>
      recordId
        ? unwrap(api.v1.attendance[':id'].$patch({ param: { id: recordId }, json: body }))
        : unwrap(api.v1.attendance.$post({ json: { payrollId, workerId: worker.id, date, ...body } })),
    onSuccess: () => finish('Registro guardado'),
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: (recordId: string) => unwrap(api.v1.attendance[':id'].$delete({ param: { id: recordId } })),
    onSuccess: () => finish('Registro eliminado'),
    onError: fail,
  })
  const busy = save.isPending || remove.isPending

  const { loaded, form, error } = session ?? { loaded: record, form: formFromRecord(record), error: null }
  const edit = (patch: Partial<RecordForm>) => setSession((s) => s && { ...s, form: { ...s.form, ...patch } })
  const worked = form.type === 'worked'
  // Management sees the money too, read-only; the coordinator never receives it. Only admin and accounting edit it.
  const showMoney = canEditMoney || readOnly

  // An error of a field that is on the screen goes under it; any other goes in an alert.
  const shown = new Set<string>(['type', 'note', ...(worked ? [...MARKS, 'overtimeMinutes'] : []), ...(showMoney ? ['hourlyRate', 'overtimeRate'] : []), ...(canEditMoney ? ['needsReview'] : [])])
  const errorOf = (field: string) => (error?.field === field ? error.message : undefined)
  const alertMessage = error && !(error.field && shown.has(error.field)) ? error.message : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly || !session) return
    setSession({ ...session, error: null })
    const body = buildRecordBody(loaded, form, { canEditMoney })
    // Nothing changed: there is nothing to send.
    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    save.mutate({ recordId: loaded?.id ?? null, body })
  }

  function confirmRemove() {
    if (!loaded) return
    if (window.confirm(`¿Eliminar el registro de ${workerName(worker)} del ${formatDate(date)}? Se perderán sus marcas.`)) {
      setSession((s) => s && { ...s, error: null })
      remove.mutate(loaded.id)
    }
  }

  const overtimeHelp = loaded
    ? loaded.overtimeEdited
      ? 'Fijadas a mano'
      : `Sugeridas: ${formatMinutes(loaded.overtimeMinutes)}`
    : 'Vacío: se calculan las sugeridas.'

  return (
    // While saving, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      {/* Phone: the content scrolls inside the dialog, down to the buttons. The 44 px "Cancelar" replaces the small close icon. */}
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug break-words">
            {workerName(worker)} · {formatDate(date)}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field id="record-type" label="Tipo" error={errorOf('type')}>
            <select
              id="record-type"
              className={`${controlClass} h-11`}
              value={form.type}
              disabled={readOnly}
              onChange={(e) => edit({ type: e.target.value as AttendanceType })}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {ATTENDANCE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>

          {worked && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                {MARKS.map((mark) => {
                  const stored = loaded?.[mark]
                  // Only a stored mark that was not edited is known to fall on the next day.
                  const nextDay = stored && form[mark] === formFromRecord(loaded)[mark] && dayOffset(date, stored) > 0
                  return (
                    <Field key={mark} id={`record-${mark}`} label={MARK_LABEL[mark]} error={errorOf(mark)} help={nextDay ? 'día siguiente' : undefined} className="min-w-0">
                      <Input
                        id={`record-${mark}`}
                        type="time"
                        className="h-11"
                        value={form[mark]}
                        readOnly={readOnly}
                        onChange={(e) => edit({ [mark]: e.target.value })}
                      />
                    </Field>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{TIME_HELP}</p>
            </div>
          )}

          {worked && (
            <div className="space-y-2">
              <Field id="record-overtime" label="Horas extra (minutos)" help={overtimeHelp} error={errorOf('overtimeMinutes')}>
                <Input
                  id="record-overtime"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="h-11"
                  value={form.overtimeMinutes}
                  readOnly={readOnly}
                  onChange={(e) => edit({ overtimeMinutes: e.target.value })}
                />
              </Field>
              {!readOnly && (
                <Button type="button" variant="outline" size="lg" className="h-11" disabled={form.overtimeMinutes === ''} onClick={() => edit({ overtimeMinutes: '' })}>
                  Usar las sugeridas
                </Button>
              )}
            </div>
          )}

          {loaded?.type === 'worked' && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <dt className="text-muted-foreground">Trabajado</dt>
              <dd className="text-right tabular-nums">{formatMinutes(loaded.workedMinutes)}</dd>
              <dt className="text-muted-foreground">Normales</dt>
              <dd className="text-right tabular-nums">{formatMinutes(loaded.regularMinutes)}</dd>
              <dt className="text-muted-foreground">Extra</dt>
              <dd className="text-right tabular-nums">{formatMinutes(loaded.overtimeMinutes)}</dd>
              {showMoney && (
                <>
                  <dt className="text-muted-foreground">Monto</dt>
                  <dd className="text-right font-medium tabular-nums">{formatCents(loaded.amountCents)}</dd>
                </>
              )}
              <dd className="col-span-2 text-xs text-muted-foreground">Es el resumen de lo guardado; se actualiza al guardar.</dd>
            </dl>
          )}

          {showMoney && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field id="record-hourly-rate" label="Tarifa por hora (S/)" error={errorOf('hourlyRate')} help={loaded ? undefined : 'Vacío: se toma del cargo, si es por hora.'} className="min-w-0">
                  <Input
                    id="record-hourly-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={99999}
                    step="any"
                    className="h-11"
                    value={form.hourlyRate}
                    readOnly={readOnly || !canEditMoney}
                    onChange={(e) => edit({ hourlyRate: e.target.value })}
                  />
                </Field>
                <Field id="record-overtime-rate" label="Tarifa por hora extra (S/)" error={errorOf('overtimeRate')} className="min-w-0">
                  <Input
                    id="record-overtime-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={99999}
                    step="any"
                    className="h-11"
                    value={form.overtimeRate}
                    readOnly={readOnly || !canEditMoney}
                    onChange={(e) => edit({ overtimeRate: e.target.value })}
                  />
                </Field>
              </div>
              {canEditMoney ? (
                <div className="space-y-1">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={form.needsReview}
                      disabled={readOnly}
                      onChange={(e) => edit({ needsReview: e.target.checked })}
                    />
                    Por revisar
                  </label>
                  {errorOf('needsReview') && (
                    <p role="alert" className="text-xs text-destructive">
                      {errorOf('needsReview')}
                    </p>
                  )}
                </div>
              ) : (
                loaded?.needsReview && <Badge variant="destructive">Por revisar</Badge>
              )}
            </>
          )}

          <Field id="record-note" label="Nota" error={errorOf('note')}>
            <Input
              id="record-note"
              className="h-11"
              maxLength={300}
              autoComplete="off"
              value={form.note}
              readOnly={readOnly}
              onChange={(e) => edit({ note: e.target.value })}
            />
          </Field>

          {alertMessage && (
            <p role="alert" className="text-sm text-destructive">
              {alertMessage}
            </p>
          )}

          <DialogFooter>
            {readOnly ? (
              <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                {loaded && (
                  <Button type="button" variant="destructive" size="lg" className="h-11 sm:mr-auto" disabled={busy} onClick={confirmRemove}>
                    Eliminar registro
                  </Button>
                )}
                <Button type="button" variant="outline" size="lg" className="h-11" disabled={busy} onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="lg" className="h-11" disabled={busy}>
                  {save.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
