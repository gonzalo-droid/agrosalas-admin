'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, claseControl } from '@/components/campo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ErrorApiCliente, leer, mensajeDeError, type Datos } from '@/lib/api'
import { useAreas, useCargos, useTurnos } from '@/lib/catalogos'
import { formatoSoles } from '@/lib/formato'

export type FichaTrabajador = Datos<(typeof api.v1.trabajadores)[':id']['$get']>

const TEXTOS = ['dni', 'nombres', 'apellidos', 'telefono', 'correo', 'direccion', 'emergenciaNombre', 'emergenciaTelefono', 'fechaIngreso', 'notas'] as const
const SELECTORES = ['areaId', 'cargoId', 'turnoId'] as const
type CampoTexto = (typeof TEXTOS)[number] | (typeof SELECTORES)[number]

function valoresIniciales(ficha?: FichaTrabajador) {
  const texto = Object.fromEntries([...TEXTOS, ...SELECTORES].map((c) => [c, ficha?.[c] ?? ''])) as Record<CampoTexto, string>
  return { ...texto, modalidad: ficha?.modalidad ?? 'temporal', estado: ficha?.estado ?? 'activo' }
}

export function FormularioTrabajador({ ficha, puedeEditar }: { ficha?: FichaTrabajador; puedeEditar: boolean }) {
  const router = useRouter()
  const cliente = useQueryClient()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: turnos } = useTurnos()
  const [v, setV] = useState(() => valoresIniciales(ficha))
  const [error, setError] = useState<{ campo?: string; mensaje: string } | null>(null)
  // Tras crear, el botón queda deshabilitado hasta que la navegación a la ficha termine.
  const [creado, setCreado] = useState(false)

  const cargo = cargos?.datos.find((c) => c.id === v.cargoId)
  const fijar = (campo: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((actual) => ({ ...actual, [campo]: e.target.value }))
  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined)

  const guardar = useMutation({
    mutationFn: () => {
      // Los campos vacíos viajan como null; el DNI vacío no se manda al editar (queda pendiente).
      const opcionales = Object.fromEntries(
        [...TEXTOS, ...SELECTORES].filter((c) => !['dni', 'nombres', 'apellidos'].includes(c)).map((c) => [c, v[c].trim() || null]),
      )
      const json = {
        ...opcionales,
        nombres: v.nombres.trim(),
        apellidos: v.apellidos.trim(),
        modalidad: v.modalidad,
        ...(v.dni.trim() ? { dni: v.dni.trim() } : {}),
      }
      return ficha
        ? leer(api.v1.trabajadores[':id'].$patch({ param: { id: ficha.id }, json: { ...json, estado: v.estado } as never }))
        : leer(api.v1.trabajadores.$post({ json: json as never }))
    },
    onSuccess: (guardado) => {
      cliente.invalidateQueries({ queryKey: ['trabajadores'] })
      toast.success('Trabajador guardado')
      if (!ficha) {
        setCreado(true)
        router.replace(`/trabajadores/${guardado.id}`)
      }
    },
    onError: (e) => {
      // El DNI es el único campo único del trabajador: un duplicado se muestra bajo ese campo.
      if (e instanceof ErrorApiCliente && e.codigo === 'duplicado') {
        setError({ campo: 'dni', mensaje: 'Ya existe un trabajador con ese DNI' })
        return
      }
      setError({ campo: e instanceof ErrorApiCliente ? e.campo : undefined, mensaje: mensajeDeError(e) })
    },
  })

  const entrada = (campo: CampoTexto, etiqueta: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Campo id={campo} etiqueta={etiqueta} error={errorDe(campo)}>
      <Input id={campo} className="h-10" value={v[campo]} onChange={fijar(campo)} disabled={!puedeEditar} {...extra} />
    </Campo>
  )
  const selector = (campo: (typeof SELECTORES)[number], etiqueta: string, lista?: { id: string; nombre: string; activo: boolean }[]) => (
    <Campo id={campo} etiqueta={etiqueta}>
      <select id={campo} className={`${claseControl} h-10`} value={v[campo]} onChange={fijar(campo)} disabled={!puedeEditar}>
        <option value="">Sin asignar</option>
        {lista?.filter((x) => x.activo || x.id === v[campo]).map((x) => (
          <option key={x.id} value={x.id}>
            {x.nombre}
          </option>
        ))}
      </select>
    </Campo>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      {ficha && !ficha.dni && (
        <p className="rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm font-medium text-amber-900">
          Falta el DNI. Este trabajador se registró solo con su nombre.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Datos personales</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {entrada('dni', ficha ? 'DNI' : 'DNI (obligatorio)', { inputMode: 'numeric', maxLength: 8, required: !ficha })}
            {entrada('telefono', 'Teléfono', { inputMode: 'tel' })}
            {entrada('nombres', 'Nombres (obligatorio)', { required: true })}
            {entrada('apellidos', 'Apellidos (obligatorio)', { required: true })}
            {entrada('correo', 'Correo', { type: 'email' })}
            {entrada('direccion', 'Dirección')}
            {entrada('emergenciaNombre', 'Contacto de emergencia')}
            {entrada('emergenciaTelefono', 'Teléfono de emergencia', { inputMode: 'tel' })}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Trabajo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {selector('areaId', 'Área', areas?.datos)}
            {selector('cargoId', 'Cargo', cargos?.datos)}
            {selector('turnoId', 'Turno (referencial)', turnos?.datos)}
            <Campo id="modalidad" etiqueta="Modalidad">
              <select id="modalidad" className={`${claseControl} h-10`} value={v.modalidad} onChange={fijar('modalidad')} disabled={!puedeEditar}>
                <option value="temporal">Temporal (pago semanal)</option>
                <option value="contrato">Contrato (pago mensual)</option>
              </select>
            </Campo>
            {entrada('fechaIngreso', 'Fecha de ingreso', { type: 'date' })}
            {ficha && (
              <Campo id="estado" etiqueta="Estado">
                <select id="estado" className={`${claseControl} h-10`} value={v.estado} onChange={fijar('estado')} disabled={!puedeEditar}>
                  <option value="activo">Activo</option>
                  <option value="cesado">Cesado</option>
                </select>
              </Campo>
            )}
          </div>
          {cargo && (cargo.tarifaHora != null || cargo.sueldoMensual != null) && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Tarifa de referencia del cargo {cargo.nombre}:{' '}
              {cargo.tipoPago === 'mensual'
                ? `${formatoSoles(cargo.sueldoMensual)} al mes`
                : `${formatoSoles(cargo.tarifaHora)} hora normal · ${formatoSoles(cargo.tarifaHoraExtra)} hora extra`}
              <span className="block text-xs text-muted-foreground">Se define en Configuración. En cada planilla se puede cambiar por registro.</span>
            </p>
          )}
          {entrada('notas', 'Notas')}
        </section>
      </div>

      {/* Los errores de un campo de texto se muestran bajo ese campo; el resto, aquí. */}
      {error && !(TEXTOS as readonly string[]).includes(error.campo ?? '') && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}

      <div className="flex gap-3">
        {puedeEditar && (
          <Button type="submit" size="lg" disabled={guardar.isPending || creado}>
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
