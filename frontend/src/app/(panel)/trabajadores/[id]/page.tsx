'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { FormularioTrabajador } from '@/components/trabajadores/formulario'
import { GruposTrabajador } from '@/components/trabajadores/grupos-trabajador'
import { MetodosPago } from '@/components/trabajadores/metodos-pago'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useYo } from '@/lib/yo'

export default function PaginaTrabajador() {
  const { id } = useParams<{ id: string }>()
  const { data: yo } = useYo()
  const { data: ficha, error } = useQuery({
    queryKey: ['trabajadores', id],
    queryFn: () => leer(api.v1.trabajadores[':id'].$get({ param: { id } })),
  })

  if (error && !ficha) return <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
  if (!ficha || !yo) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const puedeEditar = yo.rol === 'admin' || yo.rol === 'contabilidad'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {ficha.nombres} {ficha.apellidos}
      </h1>
      {/* key: al refrescar la ficha, el formulario toma los valores nuevos */}
      <FormularioTrabajador key={ficha.actualizadoEn} ficha={ficha} puedeEditar={puedeEditar} />
      {puedeEditar && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <MetodosPago ficha={ficha} />
          <GruposTrabajador ficha={ficha} />
        </div>
      )}
    </div>
  )
}
