'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, controlClass } from '@/components/field'
import { WorkerPicker, type Worker } from '@/components/payrolls/worker-picker'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiClientError, errorMessage, unwrap } from '@/lib/api'
import { useCampaigns, useGroups } from '@/lib/catalogs'
import { dateRange } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { suggestedPayroll, type PayrollType } from '@/lib/payroll-view'

const NAME_MAX = 80

const TYPE_OPTIONS: { value: PayrollType; label: string }[] = [
  { value: 'weekly', label: 'Semanal (personal temporal)' },
  { value: 'monthly', label: 'Mensual (personal con contrato)' },
]

type Source = 'pick' | 'group' | 'payroll' | 'allTemporary' | 'later'
const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'pick', label: 'Elegir uno por uno' },
  { value: 'group', label: 'Cargar un grupo' },
  { value: 'payroll', label: 'Copiar de otra planilla' },
  { value: 'allTemporary', label: 'Todos los temporales activos' },
  { value: 'later', label: 'Agregarlos después' },
]

// The fields that have a place under them for the API's error.
const FIELDS = ['type', 'campaignId', 'name', 'startDate', 'endDate']

// Name and dates of the suggestion; the name is cut to what the API accepts.
function suggestion(type: PayrollType, today: string, campaignName?: string) {
  const suggested = suggestedPayroll(type, today, campaignName)
  return { ...suggested, name: suggested.name.slice(0, NAME_MAX) }
}

export function PayrollForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: campaigns } = useCampaigns()
  const { data: groups } = useGroups()
  // Today in Lima, never the device's date.
  const today = limaDate(new Date())
  const [type, setType] = useState<PayrollType>('weekly')
  const [campaignId, setCampaignId] = useState('')
  const [values, setValues] = useState(() => {
    const { name, startDate, endDate } = suggestion('weekly', today)
    return { name, startDate, endDate }
  })
  // A field the user has typed in is no longer re-suggested.
  const [touched, setTouched] = useState({ name: false, startDate: false, endDate: false })
  const [source, setSource] = useState<Source>('later')
  const [picked, setPicked] = useState<Worker[]>([])
  const [groupId, setGroupId] = useState('')
  const [fromPayrollId, setFromPayrollId] = useState('')
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  // After creating, the button stays disabled until the navigation to the payroll finishes.
  const [created, setCreated] = useState(false)

  const { data: recent, error: recentError } = useQuery({
    queryKey: ['payrolls', 'recent'],
    enabled: source === 'payroll',
    queryFn: () => unwrap(api.v1.payrolls.$get({ query: { page: '1', pageSize: '20' } })),
  })

  const activeCampaigns = campaigns?.items.filter((c) => c.active) ?? []
  const activeGroups = groups?.items.filter((g) => g.active) ?? []
  const errorFor = (field: string) => (error?.field === field ? error.message : undefined)

  // Changing the type or the campaign proposes again only the fields the user has not touched.
  function resuggest(nextType: PayrollType, nextCampaignId: string) {
    const campaignName = campaigns?.items.find((c) => c.id === nextCampaignId)?.name
    const suggested = suggestion(nextType, today, campaignName)
    setValues((v) => ({
      name: touched.name ? v.name : suggested.name,
      startDate: touched.startDate ? v.startDate : suggested.startDate,
      endDate: touched.endDate ? v.endDate : suggested.endDate,
    }))
  }
  const edit = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setTouched((t) => ({ ...t, [field]: true }))
  }

  // The API accepts exactly one way to load workers: the body carries one key or none.
  function workersSource() {
    if (source === 'pick' && picked.length > 0) return { workerIds: picked.map((w) => w.id) }
    if (source === 'group') return { groupId }
    if (source === 'payroll') return { payrollId: fromPayrollId }
    if (source === 'allTemporary') return { allActiveTemporary: true as const }
    return undefined
  }

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        api.v1.payrolls.$post({
          json: {
            name: values.name.trim(),
            type,
            startDate: values.startDate,
            endDate: values.endDate,
            campaignId: campaignId || null,
            workers: workersSource(),
          },
        }),
      ),
    onSuccess: (payroll) => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] })
      toast.success('Planilla creada')
      setCreated(true)
      router.push(`/payrolls/${payroll.id}`)
    },
    onError: (e) => setError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) }),
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        if (source === 'group' && !groupId) return setError({ message: 'Elige un grupo.' })
        if (source === 'payroll' && !fromPayrollId) return setError({ message: 'Elige la planilla de la que copiar.' })
        save.mutate()
      }}
    >
      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Datos de la planilla</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="type" label="Tipo" error={errorFor('type')}>
            <select
              id="type"
              className={`${controlClass} h-10`}
              value={type}
              onChange={(e) => {
                const next = e.target.value as PayrollType
                setType(next)
                resuggest(next, campaignId)
              }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="campaignId" label="Campaña (opcional)" error={errorFor('campaignId')}>
            <select
              id="campaignId"
              className={`${controlClass} h-10`}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value)
                resuggest(type, e.target.value)
              }}
            >
              <option value="">Sin campaña</option>
              {activeCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="name" label="Nombre" error={errorFor('name')} className="sm:col-span-2">
            <Input id="name" className="h-10" required maxLength={NAME_MAX} value={values.name} onChange={edit('name')} />
          </Field>
          <Field id="startDate" label="Desde" error={errorFor('startDate')}>
            <Input id="startDate" type="date" className="h-10" required value={values.startDate} onChange={edit('startDate')} />
          </Field>
          <Field id="endDate" label="Hasta" error={errorFor('endDate')}>
            <Input id="endDate" type="date" className="h-10" required value={values.endDate} onChange={edit('endDate')} />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Trabajadores</legend>
          {SOURCE_OPTIONS.map((o) => (
            <label key={o.value} className="flex min-h-9 items-center gap-2 text-sm">
              <input
                type="radio"
                name="workersSource"
                className="size-4"
                value={o.value}
                checked={source === o.value}
                onChange={() => setSource(o.value)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>

        {source === 'pick' && <WorkerPicker value={picked} onChange={setPicked} />}
        {source === 'group' && (
          <Field id="groupId" label="Grupo">
            <select id="groupId" className={`${controlClass} h-10`} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">Elige un grupo</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.members} {g.members === 1 ? 'miembro' : 'miembros'})
                </option>
              ))}
            </select>
          </Field>
        )}
        {source === 'payroll' && (
          <Field id="fromPayrollId" label="Planilla de la que copiar" error={recentError ? errorMessage(recentError) : undefined}>
            <select id="fromPayrollId" className={`${controlClass} h-10`} value={fromPayrollId} onChange={(e) => setFromPayrollId(e.target.value)}>
              <option value="">Elige una planilla</option>
              {recent?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({dateRange(p.startDate, p.endDate)}, {p.workerCount} {p.workerCount === 1 ? 'persona' : 'personas'})
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      {/* The errors of a field are shown under that field; the rest, here. */}
      {error && !FIELDS.includes(error.field ?? '') && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={save.isPending || created}>
          Crear planilla
        </Button>
        <Link href="/payrolls" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
