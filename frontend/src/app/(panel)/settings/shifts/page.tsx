'use client'

import { Catalog } from '@/components/catalog'
import { api, unwrap } from '@/lib/api'

const time = (value: unknown) => String(value).slice(0, 5)

export default function ShiftsPage() {
  return (
    <Catalog
      title="Turnos"
      description="Son referenciales: no intervienen en el cálculo de horas."
      newLabel="Nuevo turno"
      queryKey="shifts"
      canEdit
      columns={[
        { title: 'Turno', cell: (row) => String(row.name) },
        { title: 'Horario', cell: (row) => `${time(row.startTime)} – ${time(row.endTime)}` },
      ]}
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'startTime', label: 'Hora de inicio', type: 'time', required: true },
        { name: 'endTime', label: 'Hora de fin', type: 'time', required: true },
      ]}
      list={() => unwrap(api.v1.shifts.$get())}
      create={(json) => unwrap(api.v1.shifts.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.shifts[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
