'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, controlClass } from '@/components/field'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ApiClientError, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { useAreas, usePositions, useShifts } from '@/lib/catalogs'
import { formatSoles } from '@/lib/format'
import { optionName } from '@/lib/worker-view'

export type WorkerRecord = ResponseBody<(typeof api.v1.workers)[':id']['$get']>

const TEXT_FIELDS = ['dni', 'firstName', 'lastName', 'phone', 'email', 'address', 'emergencyContactName', 'emergencyContactPhone', 'hireDate', 'notes'] as const
const SELECT_FIELDS = ['areaId', 'positionId', 'shiftId'] as const
type FormField = (typeof TEXT_FIELDS)[number] | (typeof SELECT_FIELDS)[number]

const EMPLOYMENT_TYPES = [
  { value: 'temporary', label: 'Temporal (pago semanal)' },
  { value: 'contract', label: 'Contrato (pago mensual)' },
]
const STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'terminated', label: 'Cesado' },
]

function initialValues(worker?: WorkerRecord) {
  const text = Object.fromEntries([...TEXT_FIELDS, ...SELECT_FIELDS].map((f) => [f, worker?.[f] ?? ''])) as Record<FormField, string>
  return { ...text, employmentType: worker?.employmentType ?? 'temporary', status: worker?.status ?? 'active' }
}

export function WorkerForm({ worker, canEdit }: { worker?: WorkerRecord; canEdit: boolean }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: areas } = useAreas()
  const { data: positions } = usePositions()
  const { data: shifts } = useShifts()
  const [values, setValues] = useState(() => initialValues(worker))
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  // After creating, the button stays disabled until the navigation to the record finishes.
  const [created, setCreated] = useState(false)

  const position = positions?.items.find((p) => p.id === values.positionId)
  const setField = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [field]: e.target.value }))
  const errorFor = (field: string) => (error?.field === field ? error.message : undefined)

  const save = useMutation({
    mutationFn: () => {
      // Empty fields travel as null; an empty DNI is not sent when editing (it stays pending).
      const optional = Object.fromEntries(
        [...TEXT_FIELDS, ...SELECT_FIELDS].filter((f) => !['dni', 'firstName', 'lastName'].includes(f)).map((f) => [f, values[f].trim() || null]),
      )
      const json = {
        ...optional,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        employmentType: values.employmentType,
        ...(values.dni.trim() ? { dni: values.dni.trim() } : {}),
      }
      return worker
        ? unwrap(api.v1.workers[':id'].$patch({ param: { id: worker.id }, json: { ...json, status: values.status } as never }))
        : unwrap(api.v1.workers.$post({ json: json as never }))
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      toast.success('Trabajador guardado')
      if (!worker) {
        setCreated(true)
        router.replace(`/trabajadores/${saved.id}`)
      }
    },
    onError: (e) => {
      // The DNI is the worker's only unique field: a duplicate is shown under that field.
      if (e instanceof ApiClientError && e.code === 'duplicate') {
        setError({ field: 'dni', message: 'Ya existe un trabajador con ese DNI' })
        return
      }
      setError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) })
    },
  })

  // Whoever cannot edit sees the data with normal contrast and can select and copy it:
  // the fields are read-only (not disabled) and each select is shown as text.
  const textInput = (field: FormField, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Field id={field} label={label} error={errorFor(field)}>
      <Input id={field} className="h-10" value={values[field]} onChange={setField(field)} readOnly={!canEdit} {...extra} />
    </Field>
  )
  const readOnlyText = (id: string, label: string, text: string) => (
    <Field id={id} label={label}>
      <Input id={id} className="h-10" value={text} readOnly />
    </Field>
  )
  const selectField = (field: (typeof SELECT_FIELDS)[number], label: string, list?: { id: string; name: string; active: boolean }[]) =>
    !canEdit ? (
      readOnlyText(field, label, optionName(list, values[field]))
    ) : (
      <Field id={field} label={label}>
        <select id={field} className={`${controlClass} h-10`} value={values[field]} onChange={setField(field)}>
          <option value="">Sin asignar</option>
          {list?.filter((x) => x.active || x.id === values[field]).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </Field>
    )
  const fixedOptionField = (field: 'employmentType' | 'status', label: string, options: { value: string; label: string }[]) =>
    !canEdit ? (
      readOnlyText(field, label, options.find((o) => o.value === values[field])?.label ?? values[field])
    ) : (
      <Field id={field} label={label}>
        <select id={field} className={`${controlClass} h-10`} value={values[field]} onChange={setField(field)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        save.mutate()
      }}
    >
      {worker && !worker.dni && (
        <p className="rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm font-medium text-amber-900">
          Falta el DNI. Este trabajador se registró solo con su nombre.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Datos personales</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {textInput('dni', worker ? 'DNI' : 'DNI (obligatorio)', { inputMode: 'numeric', maxLength: 8, required: !worker })}
            {textInput('phone', 'Teléfono', { inputMode: 'tel', maxLength: 20 })}
            {textInput('firstName', 'Nombres (obligatorio)', { required: true, maxLength: 80 })}
            {textInput('lastName', 'Apellidos (obligatorio)', { required: true, maxLength: 80 })}
            {textInput('email', 'Correo', { type: 'email' })}
            {textInput('address', 'Dirección', { maxLength: 160 })}
            {textInput('emergencyContactName', 'Contacto de emergencia', { maxLength: 80 })}
            {textInput('emergencyContactPhone', 'Teléfono de emergencia', { inputMode: 'tel', maxLength: 20 })}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Trabajo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectField('areaId', 'Área', areas?.items)}
            {selectField('positionId', 'Cargo', positions?.items)}
            {selectField('shiftId', 'Turno (referencial)', shifts?.items)}
            {fixedOptionField('employmentType', 'Modalidad', EMPLOYMENT_TYPES)}
            {textInput('hireDate', 'Fecha de ingreso', { type: 'date' })}
            {worker && fixedOptionField('status', 'Estado', STATUSES)}
          </div>
          {position && (position.hourlyRate != null || position.monthlySalary != null) && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Tarifa de referencia del cargo {position.name}:{' '}
              {position.payType === 'monthly'
                ? `${formatSoles(position.monthlySalary)} al mes`
                : `${formatSoles(position.hourlyRate)} hora normal · ${formatSoles(position.overtimeRate)} hora extra`}
              <span className="block text-xs text-muted-foreground">Se define en Configuración. En cada planilla se puede cambiar por registro.</span>
            </p>
          )}
          {textInput('notes', 'Notas', { maxLength: 500 })}
        </section>
      </div>

      {/* The errors of a text field are shown under that field; the rest, here. */}
      {error && !(TEXT_FIELDS as readonly string[]).includes(error.field ?? '') && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      <div className="flex gap-3">
        {canEdit && (
          <Button type="submit" size="lg" disabled={save.isPending || created}>
            Guardar
          </Button>
        )}
        <Link href="/trabajadores" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Volver
        </Link>
      </div>
    </form>
  )
}
