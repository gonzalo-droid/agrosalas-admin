'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

export default function PaginaCampanas() {
  return (
    <Catalogo
      titulo="Campañas"
      descripcion="Cada planilla puede llevar una campaña; los reportes suman el costo por campaña."
      textoNuevo="Nueva campaña"
      claveConsulta="campanas"
      puedeEditar
      columnas={[
        { titulo: 'Campaña', celda: (f) => String(f.nombre) },
        { titulo: 'Fechas', celda: (f) => (f.fechaInicio ? `${f.fechaInicio} a ${f.fechaFin ?? '…'}` : 'Sin fechas') },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha' },
        { nombre: 'fechaFin', etiqueta: 'Fecha de fin', tipo: 'fecha' },
      ]}
      listar={() => leer(api.v1.campanas.$get())}
      crear={(json) => leer(api.v1.campanas.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.campanas[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
