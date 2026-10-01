'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiClientError, errorMessage } from '@/lib/api'
import {
  applyChange,
  buildRequestBody,
  initialValue,
  visibleFields,
  visibleOptions,
  type CatalogField,
  type CatalogRow,
  type Value,
  type Values,
} from '@/lib/catalog-values'
import { Field, controlClass } from './field'
import { ErrorWithRetry } from './error-with-retry'

export type { CatalogField, CatalogRow }

type Props = {
  title: string
  description?: string
  newLabel: string
  queryKey: string
  canEdit: boolean
  columns: { title: string; right?: boolean; cell: (row: CatalogRow) => React.ReactNode }[]
  fields: CatalogField[]
  list: () => Promise<{ items: CatalogRow[] }>
  create: (values: Record<string, unknown>) => Promise<unknown>
  update: (id: string, values: Record<string, unknown>) => Promise<unknown>
  // Lets one field be proposed from another (e.g. the overtime rate from the regular rate). Only when creating.
  derive?: (field: string, values: Values) => Partial<Values>
  rowActions?: (row: CatalogRow) => React.ReactNode
}

const INPUT_TYPE = { text: 'text', email: 'email', password: 'password', time: 'time', date: 'date', number: 'number' } as const
// The browser must not fill these forms with the data of whoever uses it (e.g. in "Nuevo usuario").
const AUTOCOMPLETE = { password: 'new-password' } as Partial<Record<CatalogField['type'], string>>

export function Catalog(props: Props) {
  const queryClient = useQueryClient()
  const { data, isPending, error, refetch } = useQuery({ queryKey: [props.queryKey], queryFn: props.list })
  const [open, setOpen] = useState(false)
  const [row, setRow] = useState<CatalogRow | null>(null)
  const [values, setValues] = useState<Values>({})
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const fields = visibleFields(props.fields, values, row !== null)
  const hasActive = row !== null && typeof row.active === 'boolean'

  function openDialog(toEdit: CatalogRow | null) {
    const initial: Values = Object.fromEntries(props.fields.map((f) => [f.name, initialValue(f, toEdit)]))
    if (toEdit && typeof toEdit.active === 'boolean') initial.active = toEdit.active
    setRow(toEdit)
    setValues(initial)
    setFieldError(null)
    setOpen(true)
  }

  function change(field: string, value: Value) {
    setValues((v) => applyChange(v, field, value, props.derive, row !== null))
  }

  const save = useMutation({
    mutationFn: () => {
      const body = buildRequestBody(props.fields, values, row !== null)
      if (hasActive) body.active = values.active
      return row ? props.update(row.id, body) : props.create(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [props.queryKey] })
      setOpen(false)
      toast.success('Guardado')
    },
    onError: (e) => setFieldError({ field: e instanceof ApiClientError ? e.field : undefined, message: errorMessage(e) }),
  })

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
        </div>
        {props.canEdit && (
          <Button size="lg" onClick={() => openDialog(null)}>
            {props.newLabel}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {props.columns.map((c) => (
                <TableHead key={c.title} className={c.right ? 'text-right' : undefined}>
                  {c.title}
                </TableHead>
              ))}
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={props.columns.length + 2}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={props.columns.length + 2}>
                  <ErrorWithRetry error={error} onRetry={refetch} />
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={props.columns.length + 2} className="text-muted-foreground">
                  Aún no hay registros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((f) => (
              <TableRow key={f.id}>
                {props.columns.map((c) => (
                  <TableCell key={c.title} className={c.right ? 'text-right tabular-nums' : undefined}>
                    {c.cell(f)}
                  </TableCell>
                ))}
                <TableCell>
                  <Badge variant={f.active === false ? 'outline' : 'secondary'}>{f.active === false ? 'Inactivo' : 'Activo'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {props.rowActions?.(f)}
                  {props.canEdit && (
                    <Button
                      variant="ghost"
                      size="lg"
                      aria-label={typeof f.name === 'string' ? `Editar ${f.name}` : undefined}
                      onClick={() => openDialog(f)}
                    >
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        {/* With a long form or the phone keyboard open, the content scrolls down to "Guardar". */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{row ? 'Editar' : props.newLabel}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setFieldError(null)
              save.mutate()
            }}
          >
            {fields.map((c) => {
              const id = `field-${c.name}`
              const error = fieldError?.field === c.name ? fieldError.message : undefined
              const value = values[c.name]
              if (c.type === 'checkbox') {
                return (
                  <div key={c.name} className="space-y-1">
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(value)} onChange={(e) => change(c.name, e.target.checked)} />
                      {c.label}
                    </label>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                )
              }
              if (c.type === 'multiselect') {
                const chosen = (value as string[]) ?? []
                return (
                  <fieldset key={c.name} className="space-y-1">
                    <legend className="text-sm font-medium">{c.label}</legend>
                    {visibleOptions(c, row).map((o) => (
                      <label key={o.value} className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={chosen.includes(o.value)}
                          onChange={(e) =>
                            change(c.name, e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value))
                          }
                        />
                        {o.label}
                      </label>
                    ))}
                    {error ? (
                      <p className="text-xs text-destructive">{error}</p>
                    ) : (
                      c.help && <p className="text-xs text-muted-foreground">{c.help}</p>
                    )}
                  </fieldset>
                )
              }
              return (
                <Field key={c.name} id={id} label={c.label} help={c.help} error={error}>
                  {c.type === 'select' ? (
                    <select id={id} className={controlClass} value={String(value ?? '')} onChange={(e) => change(c.name, e.target.value)}>
                      {visibleOptions(c, row).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      className="h-10"
                      type={INPUT_TYPE[c.type]}
                      step={c.type === 'number' ? 'any' : undefined}
                      required={c.required}
                      autoComplete={AUTOCOMPLETE[c.type] ?? 'off'}
                      value={String(value ?? '')}
                      onChange={(e) => change(c.name, e.target.value)}
                    />
                  )}
                </Field>
              )
            })}
            {hasActive && (
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(values.active)} onChange={(e) => change('active', e.target.checked)} />
                Activo
              </label>
            )}
            {fieldError && !fields.some((c) => c.name === fieldError.field) && (
              <p role="alert" className="text-sm text-destructive">
                {fieldError.message}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={save.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
