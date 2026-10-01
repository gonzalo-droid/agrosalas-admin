'use client'

import { Catalog } from '@/components/catalog'
import { api, unwrap } from '@/lib/api'
import { dateRange } from '@/lib/format'

export default function CampaignsPage() {
  return (
    <Catalog
      title="Campañas"
      description="Cada planilla puede llevar una campaña; los reportes suman el costo por campaña."
      newLabel="Nueva campaña"
      queryKey="campaigns"
      canEdit
      columns={[
        { title: 'Campaña', cell: (row) => String(row.name) },
        { title: 'Fechas', cell: (row) => dateRange(row.startDate as string | null, row.endDate as string | null) || 'Sin fechas' },
      ]}
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'startDate', label: 'Fecha de inicio', type: 'date' },
        { name: 'endDate', label: 'Fecha de fin', type: 'date' },
      ]}
      list={() => unwrap(api.v1.campaigns.$get())}
      create={(json) => unwrap(api.v1.campaigns.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.campaigns[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
