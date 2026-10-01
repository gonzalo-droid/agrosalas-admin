'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { FormularioTrabajador } from '@/components/trabajadores/formulario'
import { GruposTrabajador } from '@/components/trabajadores/grupos-trabajador'
import { MetodosPago } from '@/components/trabajadores/metodos-pago'
import { api, leer, mensajeDeError } from '@/lib/api'
import { vistaTrabajador } from '@/lib/trabajador-vista'
import { useYo } from '@/lib/yo'

export default function PaginaTrabajador() {
  const { id } = useParams<{ id: string }>()
  const { data: yo } = useYo()
  const { data: ficha, error } = useQuery({
    queryKey: ['trabajadores', id],
    queryFn: () => leer(api.v1.workers[':id'].$get({ param: { id } })),
  })

  if (error && !ficha) return <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
  if (!ficha || !yo) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const vista = vistaTrabajador(yo.role)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {ficha.firstName} {ficha.lastName}
      </h1>
      {/* key: al refrescar la ficha, el formulario toma los valores nuevos */}
      <FormularioTrabajador key={ficha.updatedAt} ficha={ficha} puedeEditar={vista.editarFicha} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {vista.metodosPago !== 'ocultar' && <MetodosPago ficha={ficha} soloLectura={vista.metodosPago === 'ver'} />}
        <GruposTrabajador ficha={ficha} soloLectura={vista.grupos === 'ver'} />
      </div>
    </div>
  )
}
