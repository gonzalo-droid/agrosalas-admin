'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ATTENDANCE_TYPE_LABEL, formatMinutes, MARK_ACTION, MARK_LABEL, MARKS, marksSummary, nextMark, type Mark } from '@/lib/attendance'
import { dayOffset } from '@/lib/lima-time'
import { workerName, type DayRecord } from './record-dialog'

export type DayWorker = { id: string; firstName: string; lastName: string; dni: string | null }

// A mark that was just tapped and is still being saved: the mark and the Lima time of the tap.
export type PendingMark = { mark: Mark; time: string }

type DayRowProps = {
  worker: DayWorker
  record: DayRecord | null
  date: string
  pending?: PendingMark
  // Marks with the current time are for the day in course, and only for the roles that register.
  canMark: boolean
  readOnly: boolean
  onMark: (mark: Mark) => void
  onOpen: () => void
}

export function DayRow({ worker, record, date, pending, canMark, readOnly, onMark, onOpen }: DayRowProps) {
  const next = nextMark(record)
  const nextDay = record !== null && MARKS.some((mark) => record[mark] && dayOffset(date, record[mark]) > 0)
  const name = workerName(worker)
  const complete = record?.type === 'worked' && next === null

  return (
    <li className="space-y-2 rounded-xl border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{name}</p>
          <p className="text-xs text-muted-foreground">{worker.dni ?? 'DNI pendiente'}</p>
        </div>
        {record?.needsReview && <Badge variant="destructive">Por revisar</Badge>}
      </div>

      <div className="min-w-0 text-sm" aria-live="polite">
        {record === null ? (
          <p className="text-muted-foreground">Sin marcar</p>
        ) : record.type === 'worked' ? (
          <p className="break-words">
            {marksSummary(record) || 'Sin horas'}
            {nextDay && <span className="ml-1 text-xs font-medium text-amber-700 dark:text-amber-400">+1 día</span>}
            {' · '}
            {formatMinutes(record.workedMinutes)}
          </p>
        ) : (
          <Badge variant="secondary">{ATTENDANCE_TYPE_LABEL[record.type]}</Badge>
        )}
        {pending && (
          <p className="font-medium text-primary">
            {MARK_LABEL[pending.mark]} {pending.time} · guardando…
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {canMark && !readOnly && next !== null && (
          <Button size="lg" className="h-11 w-full sm:w-auto" disabled={pending !== undefined} onClick={() => onMark(next)}>
            {MARK_ACTION[next]}
          </Button>
        )}
        {complete && <p className="text-sm font-medium text-muted-foreground">Completo</p>}
        <Button variant="outline" size="lg" className="h-11 w-full sm:w-auto" aria-label={`${readOnly ? 'Ver' : record ? 'Editar' : 'Registrar'} ${name}`} onClick={onOpen}>
          {readOnly ? 'Ver' : record ? 'Editar' : 'Registrar'}
        </Button>
      </div>
    </li>
  )
}
