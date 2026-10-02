'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Field, controlClass } from '@/components/field'
import { AttendanceGrid } from '@/components/payrolls/attendance-grid'
import { PaymentsTab } from '@/components/payrolls/payments-tab'
import { PayrollWorkers } from '@/components/payrolls/payroll-workers'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiClientError, api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { useCampaigns } from '@/lib/catalogs'
import { dateRange } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { useMe } from '@/lib/me'
import { payrollChanges, tabFromParam, type PayrollTab } from '@/lib/payroll-detail'
import { PAYROLL_STATUS_LABEL, PAYROLL_TYPE_LABEL, payrollDisplayStatus, seesMoney } from '@/lib/payroll-view'
import { cn } from '@/lib/utils'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>

const NAME_MAX = 80
const TABS: { key: PayrollTab; label: string }[] = [
  { key: 'attendance', label: 'Asistencia' },
  { key: 'payments', label: 'Pagos' },
  { key: 'workers', label: 'Trabajadores' },
]
// The fields of the edit dialog that have a place under them for the API's error.
const EDIT_FIELDS = ['name', 'startDate', 'endDate', 'campaignId']

// useSearchParams needs a Suspense boundary above it: without one, the build of the page fails.
export default function PayrollPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <PayrollDetail />
    </Suspense>
  )
}

function PayrollDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data: me } = useMe()
  const [editing, setEditing] = useState(false)

  const { data: payroll, error, refetch } = useQuery({
    queryKey: ['payrolls', id],
    queryFn: () => unwrap(api.v1.payrolls[':id'].$get({ param: { id } })),
  })

  const backLink = (
    <Link href="/payrolls" className="text-sm text-primary">
      ← Planillas
    </Link>
  )

  // A payroll that does not exist (or cannot be loaded) must not stay on "Cargando…".
  if (error && !payroll) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorWithRetry error={error} onRetry={refetch} />
      </div>
    )
  }
  if (!payroll || !me) return <p className="text-sm text-muted-foreground">Cargando…</p>

  // Hiding by role is a convenience: the API enforces the permissions. Money is hidden by role, never by looking for null.
  const canEdit = me.role === 'admin' || me.role === 'accounting'
  const canRegister = canEdit || me.role === 'coordinator'
  const showMoney = seesMoney(me.role)
  const status = payrollDisplayStatus(payroll, limaDate(new Date()))
  const tab = tabFromParam(params.get('tab'), showMoney)
  // The payments tab exists only for the roles that see money; the arrow keys walk the tabs that are shown.
  const tabs = TABS.filter((t) => t.key !== 'payments' || showMoney)

  const goTo = (next: PayrollTab) => router.replace(next === 'attendance' ? pathname : `${pathname}?tab=${next}`, { scroll: false })

  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = tabs[(tabs.findIndex((t) => t.key === tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].key
    goTo(next)
    document.getElementById(`payroll-tab-${next}`)?.focus()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {backLink}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold break-words">{payroll.name}</h1>
          <div className="flex flex-wrap gap-2">
            {status === 'in_progress' && (
              <Link href={`/attendance?payrollId=${payroll.id}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                Asistencia de hoy
              </Link>
            )}
            {canEdit && (
              <Button size="lg" onClick={() => setEditing(true)}>
                Editar
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{dateRange(payroll.startDate, payroll.endDate)}</span>
          <span>{PAYROLL_TYPE_LABEL[payroll.type]}</span>
          <span>{payroll.campaignName ?? 'Sin campaña'}</span>
          <Badge variant={payroll.status === 'closed' ? 'outline' : 'secondary'}>{PAYROLL_STATUS_LABEL[status]}</Badge>
        </div>
      </div>

      <div role="tablist" aria-label="Secciones de la planilla" className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`payroll-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`payroll-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={cn(
              '-mb-px h-11 border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => goTo(t.key)}
            onKeyDown={onTabKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`payroll-panel-${tab}`} aria-labelledby={`payroll-tab-${tab}`}>
        {tab === 'attendance' ? (
          <AttendanceGrid
            payroll={payroll}
            canEditMoney={canEdit}
            canRegister={canRegister}
            readOnly={me.role === 'management'}
            showMoney={showMoney}
            onGoToWorkers={() => goTo('workers')}
          />
        ) : tab === 'payments' ? (
          // Paying is built in a later task: until then the button does nothing.
          <PaymentsTab payroll={payroll} canPay={canEdit} onPay={() => {}} />
        ) : (
          <PayrollWorkers payroll={payroll} canEdit={canEdit} />
        )}
      </div>

      {canEdit && <EditPayrollDialog payroll={payroll} open={editing} onOpenChange={setEditing} />}
    </div>
  )
}

function EditPayrollDialog({ payroll, open, onOpenChange }: { payroll: Payroll; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data: campaigns } = useCampaigns()
  // The form is rebuilt from the stored payroll every time the dialog opens.
  type Values = Record<'name' | 'startDate' | 'endDate' | 'campaignId', string>
  const stored: Values = { name: payroll.name, startDate: payroll.startDate, endDate: payroll.endDate, campaignId: payroll.campaignId ?? '' }
  const [form, setForm] = useState<Values | null>(null)
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)

  if (open && !form) setForm(stored)
  if (!open && form) {
    setForm(null)
    setError(null)
  }
  const values = form ?? stored
  const edit = (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => f && { ...f, [field]: e.target.value })

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof payrollChanges>) => unwrap(api.v1.payrolls[':id'].$patch({ param: { id: payroll.id }, json: body })),
    onSuccess: () => {
      // The detail and the list.
      void queryClient.invalidateQueries({ queryKey: ['payrolls'] })
      toast.success('Planilla actualizada')
      onOpenChange(false)
    },
    onError: (e) => setError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) }),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const changes = payrollChanges(payroll, values)
    // Nothing changed: the API would refuse an empty body, and there is nothing to save.
    if (Object.keys(changes).length === 0) return onOpenChange(false)
    save.mutate(changes)
  }

  const errorFor = (field: string) => (error?.field === field ? error.message : undefined)
  // Active campaigns, and the one the payroll already has even if it was deactivated since.
  const options = campaigns?.items.filter((c) => c.active || c.id === payroll.campaignId) ?? []

  return (
    // While saving, the dialog cannot be dismissed: the answer must still find it open.
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar planilla</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field id="edit-name" label="Nombre" error={errorFor('name')}>
            <Input id="edit-name" className="h-10" required maxLength={NAME_MAX} value={values.name} onChange={edit('name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="edit-start-date" label="Desde" error={errorFor('startDate')}>
              <Input id="edit-start-date" type="date" className="h-10" required value={values.startDate} onChange={edit('startDate')} />
            </Field>
            <Field id="edit-end-date" label="Hasta" error={errorFor('endDate')}>
              <Input id="edit-end-date" type="date" className="h-10" required value={values.endDate} onChange={edit('endDate')} />
            </Field>
          </div>
          <Field id="edit-campaign" label="Campaña (opcional)" error={errorFor('campaignId')}>
            <select id="edit-campaign" className={`${controlClass} h-10`} value={values.campaignId} onChange={edit('campaignId')}>
              <option value="">Sin campaña</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          {/* The errors of a field are shown under that field; the rest (e.g. records outside the new dates), here. */}
          {error && !EDIT_FIELDS.includes(error.field ?? '') && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={save.isPending} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
