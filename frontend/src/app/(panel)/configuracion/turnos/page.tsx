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
        { titulo: 'Turno', celda: (f) => String(f.nombre) },
        { titulo: 'Horario', celda: (f) => `${hora(f.horaInicio)} – ${hora(f.horaFin)}` },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'horaInicio', etiqueta: 'Hora de inicio', tipo: 'hora', obligatorio: true },
        { nombre: 'horaFin', etiqueta: 'Hora de fin', tipo: 'hora', obligatorio: true },
      ]}
      listar={() => leer(api.v1.turnos.$get())}
      crear={(json) => leer(api.v1.turnos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.turnos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
