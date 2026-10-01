'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { rangoFechas } from '@/lib/formato'

export default function PaginaCampanas() {
  return (
    <Catalogo
      titulo="Campañas"
      descripcion="Cada planilla puede llevar una campaña; los reportes suman el costo por campaña."
      textoNuevo="Nueva campaña"
      claveConsulta="campanas"
      puedeEditar
      columnas={[
        { titulo: 'Campaña', celda: (f) => String(f.name) },
        { titulo: 'Fechas', celda: (f) => rangoFechas(f.startDate as string | null, f.endDate as string | null) || 'Sin fechas' },
      ]}
      campos={[
        { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'startDate', etiqueta: 'Fecha de inicio', tipo: 'fecha' },
        { nombre: 'endDate', etiqueta: 'Fecha de fin', tipo: 'fecha' },
      ]}
      listar={() => leer(api.v1.campaigns.$get())}
      crear={(json) => leer(api.v1.campaigns.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.campaigns[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
