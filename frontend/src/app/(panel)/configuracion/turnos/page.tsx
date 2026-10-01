'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

const hora = (valor: unknown) => String(valor).slice(0, 5)

export default function PaginaTurnos() {
  return (
    <Catalogo
      titulo="Turnos"
      descripcion="Son referenciales: no intervienen en el cálculo de horas."
      textoNuevo="Nuevo turno"
      claveConsulta="turnos"
      puedeEditar
      columnas={[
        { titulo: 'Turno', celda: (f) => String(f.name) },
        { titulo: 'Horario', celda: (f) => `${hora(f.startTime)} – ${hora(f.endTime)}` },
      ]}
      campos={[
        { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'startTime', etiqueta: 'Hora de inicio', tipo: 'hora', obligatorio: true },
        { nombre: 'endTime', etiqueta: 'Hora de fin', tipo: 'hora', obligatorio: true },
      ]}
      listar={() => leer(api.v1.shifts.$get())}
      crear={(json) => leer(api.v1.shifts.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.shifts[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
