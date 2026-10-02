'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { DayRow, type PendingMark } from '@/components/attendance/day-row'
import { RecordDialog } from '@/components/attendance/record-dialog'
import { controlClass } from '@/components/field'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { nextMark, type Mark } from '@/lib/attendance'
import { useAreas } from '@/lib/catalogs'
import { dateRange } from '@/lib/format'
import { addDays, isRealDate, limaDate, limaTime } from '@/lib/lima-time'
import { useMe } from '@/lib/me'
import { cn } from '@/lib/utils'

type DayList = ResponseBody<typeof api.v1.attendance.$get>
type DayItem = DayList['items'][number]

const BULK_CHUNK = 200
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// A date from the address, or null if it is not a real 'YYYY-MM-DD' (then the screen shows today).
const validDate = (value: string | null): string | null => (value !== null && isRealDate(value) ? value : null)

const fetchDay = (payrollId: string, date: string, areaId: string) =>
  unwrap(api.v1.attendance.$get({ query: { payrollId, date, ...(areaId ? { areaId } : {}) } }))

const dayKey = (payrollId: string | undefined, date: string, areaId: string) => ['attendance', payrollId, date, areaId]
// Every cached list of that payroll and day, whatever the area filter was: they all hold the same records.
const dayPrefix = (payrollId: string | undefined, date: string) => ['attendance', payrollId, date]
// A mark in flight belongs to a payroll, a day and a worker: on another day the same worker is not pending.
const pendingKey = (payrollId: string | undefined, date: string, workerId: string) => `${payrollId}|${date}|${workerId}`

// useSearchParams needs a Suspense boundary above it: without one, the build of the page fails.
export default function AttendancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <DailyAttendance />
    </Suspense>
  )
}

function DailyAttendance() {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { data: me } = useMe()
  const { data: areas } = useAreas()

  // Today in Lima, never the device's date.
  const today = limaDate(new Date())
  const date = validDate(params.get('date')) ?? today
  const isToday = date === today
  const [areaId, setAreaId] = useState('')
  const [pending, setPending] = useState<Record<string, PendingMark>>({})
  // The dialog keeps the payroll and the date it was opened on: the address can change under it (browser Back).
  const [dialog, setDialog] = useState<{ open: boolean; item: DayItem; payrollId: string; date: string } | null>(null)

  const readOnly = me?.role === 'management'
  const canEditMoney = me?.role === 'admin' || me?.role === 'accounting'

  // Open payrolls that include the day.
  const payrolls = useQuery({
    queryKey: ['payrolls', 'open-on', date],
    queryFn: () => unwrap(api.v1.payrolls.$get({ query: { status: 'open', from: date, to: date, pageSize: '50' } })),
  })
  const payroll = payrolls.data?.items.find((p) => p.id === params.get('payrollId')) ?? payrolls.data?.items[0]

  const goTo = (nextDate: string, payrollId = payroll?.id) => `/attendance?date=${nextDate}${payrollId ? `&payrollId=${payrollId}` : ''}`

  // If the day or the payroll of the screen changes, the dialog goes away with them (and does not come back on return).
  if (dialog && (dialog.date !== date || dialog.payrollId !== payroll?.id)) setDialog(null)

  const list = useQuery({
    queryKey: dayKey(payroll?.id, date, areaId),
    queryFn: () => fetchDay(payroll!.id, date, areaId),
    enabled: payroll !== undefined,
  })

  // Yesterday's open records matter on the night shift: whoever clocked in yesterday and has no exit yet.
  const yesterday = addDays(date, -1)
  const yesterdayList = useQuery({
    queryKey: dayKey(payroll?.id, yesterday, areaId),
    queryFn: () => fetchDay(payroll!.id, yesterday, areaId),
    enabled: isToday && payroll !== undefined && yesterday >= payroll.startDate,
  })
  const openYesterday = yesterdayList.data?.items.filter((i) => i.record?.type === 'worked' && nextMark(i.record) !== null).length ?? 0

  const clock = useMutation({
    mutationFn: (v: { payrollId: string; workerId: string; date: string; areaId: string; mark: Mark }) =>
      unwrap(api.v1.attendance.clock.$post({ json: { payrollId: v.payrollId, workerId: v.workerId, date: v.date, mark: v.mark } })),
    // A mark must be sent at the moment of the tap or not at all: the server stamps the time of the request it
    // receives, and a retry can be delayed (e.g. while the user is in another app). So: no retries, and offline
    // ('always', not the default 'online') the request fails at once instead of waiting for the connection. The
    // user taps again; marking is idempotent, so a repeated tap is safe.
    networkMode: 'always',
    retry: false,
    onSuccess: (record, v) =>
      queryClient.setQueriesData<DayList>({ queryKey: dayPrefix(v.payrollId, v.date) }, (old) =>
        old && { ...old, items: old.items.map((item) => (item.worker.id === v.workerId ? { ...item, record } : item)) },
      ),
    onError: (e, v) => {
      toast.error(`${errorMessage(e)} Vuelve a tocar el botón.`)
      // Load the list again: the row was out of date (e.g. someone else marked it), or the server applied the mark
      // although the answer was lost.
      void queryClient.invalidateQueries({ queryKey: dayPrefix(v.payrollId, v.date) })
    },
    onSettled: (_data, _error, v) =>
      setPending((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== pendingKey(v.payrollId, v.date, v.workerId)))),
  })

  function tap(workerId: string, mark: Mark) {
    if (!payroll) return
    setPending((current) => ({ ...current, [pendingKey(payroll.id, date, workerId)]: { mark, time: limaTime(new Date().toISOString()) } }))
    clock.mutate({ payrollId: payroll.id, workerId, date, areaId, mark })
  }

  const items = list.data?.items
  // Only the workers listed with no record, and that are not being marked right now.
  const unmarked = items?.filter((i) => i.record === null && !pending[pendingKey(payroll?.id, date, i.worker.id)]) ?? []

  const bulk = useMutation({
    // Same reason as the single mark: no waiting for the connection and no retries; the user repeats the action.
    networkMode: 'always',
    retry: false,
    mutationFn: async (workerIds: string[]) => {
      let marked = 0
      const failures: string[] = []
      for (let start = 0; start < workerIds.length; start += BULK_CHUNK) {
        const chunk = workerIds.slice(start, start + BULK_CHUNK)
        try {
          const { results } = await unwrap(api.v1.attendance.bulk.$post({ json: { payrollId: payroll!.id, date, mark: 'clockIn1', workerIds: chunk } }))
          for (const result of results) {
            if (result.ok) marked += 1
            else failures.push(result.message)
          }
        } catch (e) {
          // The request itself failed: this batch and the ones after it were not marked.
          failures.push(...workerIds.slice(start).map(() => errorMessage(e)))
          break
        }
      }
      return { marked, failures }
    },
    onSuccess: ({ marked, failures }) => {
      if (marked > 0) toast.success(plural(marked, 'marcado', 'marcados'))
      if (failures.length > 0) toast.error(`${failures.length} no se pudieron marcar`, { description: failures[0] })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: dayPrefix(payroll?.id, date) }),
  })

  function markEveryone() {
    const time = limaTime(new Date().toISOString())
    if (window.confirm(`¿Marcar el ingreso de ${plural(unmarked.length, 'trabajador', 'trabajadores')} a las ${time}?`)) {
      bulk.mutate(unmarked.map((i) => i.worker.id))
    }
  }

  const stepClass = cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Asistencia</h1>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Link href={goTo(addDays(date, -1))} className={stepClass}>
            Día anterior
          </Link>
          <Link href={goTo(addDays(date, 1))} className={stepClass}>
            Día siguiente
          </Link>
        </div>
        <Input
          aria-label="Fecha"
          type="date"
          className="h-11"
          value={date}
          onChange={(e) => {
            const picked = validDate(e.target.value)
            if (picked) router.replace(goTo(picked))
          }}
        />

        {payrolls.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {payrolls.error && <ErrorWithRetry error={payrolls.error} onRetry={payrolls.refetch} />}
        {payrolls.data && payroll && (
          <div className="grid gap-3 sm:grid-cols-2">
            {payrolls.data.items.length > 1 ? (
              <select aria-label="Planilla" className={cn(controlClass, 'h-11')} value={payroll.id} onChange={(e) => router.replace(goTo(date, e.target.value))}>
                {payrolls.data.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({dateRange(p.startDate, p.endDate)})
                  </option>
                ))}
              </select>
            ) : (
              <p className="min-w-0 self-center text-sm break-words text-muted-foreground">
                {payroll.name} · {dateRange(payroll.startDate, payroll.endDate)}
              </p>
            )}
            <select aria-label="Área" className={cn(controlClass, 'h-11')} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas las áreas</option>
              {areas?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {payrolls.data && !payroll && (
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <p className="text-sm text-muted-foreground">No hay una planilla abierta para este día.</p>
          {canEditMoney && (
            <Link href="/payrolls/new" className={cn(buttonVariants({ size: 'lg' }), 'h-11')}>
              Crear planilla
            </Link>
          )}
        </div>
      )}

      {payroll && openYesterday > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p>{plural(openYesterday, 'registro', 'registros')} de ayer sin salida</p>
          <Link href={goTo(yesterday)} className={stepClass}>
            Ver ayer
          </Link>
        </div>
      )}

      {payroll && list.isPending && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {list.error && <ErrorWithRetry error={list.error} onRetry={list.refetch} />}

      {payroll && items && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {plural(items.length, 'trabajador', 'trabajadores')} · {items.filter((i) => i.record?.clockIn1).length} con ingreso
            </p>
            {!readOnly && isToday && unmarked.length > 0 && (
              <Button size="lg" className="h-11 w-full sm:w-auto" disabled={bulk.isPending} onClick={markEveryone}>
                {bulk.isPending ? 'Marcando…' : 'Marcar ingreso a todos'}
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="space-y-3 rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Esta planilla no tiene trabajadores en esta área.</p>
              {areaId === '' && canEditMoney && (
                <Link href={`/payrolls/${payroll.id}`} className={stepClass}>
                  Agregar trabajadores a la planilla
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <DayRow
                  key={item.worker.id}
                  worker={item.worker}
                  record={item.record}
                  date={date}
                  pending={pending[pendingKey(payroll.id, date, item.worker.id)]}
                  canMark={isToday}
                  readOnly={readOnly}
                  onMark={(mark) => tap(item.worker.id, mark)}
                  onOpen={() => setDialog({ open: true, item, payrollId: payroll.id, date })}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {dialog && (
        <RecordDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => d && { ...d, open })}
          payrollId={dialog.payrollId}
          date={dialog.date}
          worker={dialog.item.worker}
          record={dialog.item.record}
          canEditMoney={canEditMoney}
          readOnly={readOnly}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: dayPrefix(dialog.payrollId, dialog.date) })}
        />
      )}
    </div>
  )
}
