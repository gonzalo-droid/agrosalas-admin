'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { workerName } from '@/components/attendance/record-dialog'
import { Field, controlClass } from '@/components/field'
import { WorkerPicker, type Worker } from '@/components/payrolls/worker-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { useGroups } from '@/lib/catalogs'
import { dateRange } from '@/lib/format'
import { addedMessage, daysRecordedByWorker } from '@/lib/payroll-detail'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// The workers of the payroll, with the days recorded of each one. Admin and accounting can add and remove.
export function PayrollWorkers({ payroll, canEdit }: { payroll: Payroll; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const days = useMemo(() => daysRecordedByWorker(payroll.records), [payroll.records])

  // ['payrolls'] is also the prefix of this detail (['payrolls', id]) and of the list, whose totals change.
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['payrolls'] })

  const remove = useMutation({
    mutationFn: (workerId: string) => unwrap(api.v1.payrolls[':id'].workers[':workerId'].$delete({ param: { id: payroll.id, workerId } })),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      toast.success('Trabajador quitado')
      refresh()
    },
    // The message arrives as the API wrote it (e.g. the worker has records in the payroll).
    onError: (e) => setRemoveError(errorMessage(e)),
  })

  function confirmRemove(worker: Payroll['workers'][number]) {
    if (window.confirm(`¿Quitar a ${workerName(worker)} de la planilla?`)) remove.mutate(worker.id)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{plural(payroll.workers.length, 'trabajador', 'trabajadores')}</p>
        {canEdit && (
          <Button size="lg" onClick={() => setAdding(true)}>
            Agregar trabajadores
          </Button>
        )}
      </div>

      {removeError && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {payroll.workers.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Esta planilla todavía no tiene trabajadores.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-background">
          {payroll.workers.map((worker) => {
            const recorded = days.get(worker.id) ?? 0
            return (
              <li key={worker.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {workerName(worker)}
                    {worker.status === 'terminated' && (
                      <Badge variant="outline" className="ml-2 align-middle">
                        Cesado
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {worker.dni ? `DNI ${worker.dni}` : 'DNI pendiente'} · {plural(recorded, 'día registrado', 'días registrados')}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="destructive"
                    size="lg"
                    className="h-10 shrink-0"
                    aria-label={`Quitar a ${workerName(worker)}`}
                    disabled={remove.isPending}
                    onClick={() => confirmRemove(worker)}
                  >
                    Quitar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && <AddWorkersDialog payroll={payroll} open={adding} onOpenChange={setAdding} onAdded={refresh} />}
    </div>
  )
}

type Source = 'pick' | 'group' | 'payroll' | 'allTemporary'
const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'pick', label: 'Elegir uno por uno' },
  { value: 'group', label: 'Cargar un grupo' },
  { value: 'payroll', label: 'Copiar de otra planilla' },
  { value: 'allTemporary', label: 'Todos los temporales activos' },
]

function AddWorkersDialog({
  payroll,
  open,
  onOpenChange,
  onAdded,
}: {
  payroll: Payroll
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const { data: groups } = useGroups()
  const [source, setSource] = useState<Source>('pick')
  const [picked, setPicked] = useState<Worker[]>([])
  const [groupId, setGroupId] = useState('')
  const [fromPayrollId, setFromPayrollId] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Same list the creation form copies from.
  const { data: recent, error: recentError } = useQuery({
    queryKey: ['payrolls', 'recent'],
    enabled: open && source === 'payroll',
    queryFn: () => unwrap(api.v1.payrolls.$get({ query: { page: '1', pageSize: '20' } })),
  })

  // The API accepts exactly one way to add workers per request: the body carries one key.
  const add = useMutation({
    mutationFn: () => {
      const json =
        source === 'pick'
          ? { workerIds: picked.map((w) => w.id) }
          : source === 'group'
            ? { groupId }
            : source === 'payroll'
              ? { payrollId: fromPayrollId }
              : { allActiveTemporary: true as const }
      return unwrap(api.v1.payrolls[':id'].workers.$post({ param: { id: payroll.id }, json }))
    },
    onSuccess: ({ added }) => {
      toast.success(addedMessage(added))
      onAdded()
      close()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  // Closing starts the form over for the next time.
  function close() {
    setSource('pick')
    setPicked([])
    setGroupId('')
    setFromPayrollId('')
    setError(null)
    onOpenChange(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (source === 'pick' && picked.length === 0) return setError('Elige al menos un trabajador.')
    if (source === 'group' && !groupId) return setError('Elige un grupo.')
    if (source === 'payroll' && !fromPayrollId) return setError('Elige la planilla de la que copiar.')
    add.mutate()
  }

  const activeGroups = groups?.items.filter((g) => g.active) ?? []
  const otherPayrolls = recent?.items.filter((p) => p.id !== payroll.id) ?? []

  return (
    // While adding, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !next && !add.isPending && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar trabajadores</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Forma de agregar</legend>
            {SOURCE_OPTIONS.map((o) => (
              <label key={o.value} className="flex min-h-9 items-center gap-2 text-sm">
                <input type="radio" name="addWorkersSource" className="size-4" value={o.value} checked={source === o.value} onChange={() => setSource(o.value)} />
                {o.label}
              </label>
            ))}
          </fieldset>

          {source === 'pick' && <WorkerPicker value={picked} onChange={setPicked} excludeIds={payroll.workers.map((w) => w.id)} />}
          {source === 'group' && (
            <Field id="add-group" label="Grupo">
              <select id="add-group" className={`${controlClass} h-10`} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Elige un grupo</option>
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({plural(g.members, 'miembro', 'miembros')})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {source === 'payroll' && (
            <Field id="add-from-payroll" label="Planilla de la que copiar" error={recentError ? errorMessage(recentError) : undefined}>
              <select id="add-from-payroll" className={`${controlClass} h-10`} value={fromPayrollId} onChange={(e) => setFromPayrollId(e.target.value)}>
                <option value="">Elige una planilla</option>
                {otherPayrolls.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({dateRange(p.startDate, p.endDate)}, {plural(p.workerCount, 'persona', 'personas')})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {source === 'allTemporary' && <p className="text-sm text-muted-foreground">Se agregan los trabajadores temporales activos que todavía no están en la planilla.</p>}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={add.isPending} onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={add.isPending}>
              {add.isPending ? 'Agregando…' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
