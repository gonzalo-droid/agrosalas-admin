'use client'

import Link from 'next/link'
import { Catalog } from '@/components/catalog'
import { buttonVariants } from '@/components/ui/button'
import { api, unwrap } from '@/lib/api'
import { dateRange } from '@/lib/format'

export default function GroupsPage() {
  return (
    <Catalog
      title="Grupos de trabajadores"
      description="Un grupo sirve para cargar varios trabajadores a una planilla de una sola vez. Un trabajador puede estar en varios."
      newLabel="Nuevo grupo"
      queryKey="groups"
      canEdit
      columns={[
        { title: 'Grupo', cell: (row) => String(row.name) },
        {
          title: 'Tipo',
          cell: (row) => {
            if (!row.temporary) return 'Fijo'
            const range = dateRange(row.startDate as string | null, row.endDate as string | null)
            return range ? `Temporal · ${range}` : 'Temporal'
          },
        },
        { title: 'Miembros', right: true, cell: (row) => String(row.members) },
      ]}
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'temporary', label: 'Es temporal (armado por unos días)', type: 'checkbox' },
        { name: 'startDate', label: 'Desde', type: 'date' },
        { name: 'endDate', label: 'Hasta', type: 'date' },
      ]}
      rowActions={(row) => (
        <Link href={`/configuracion/grupos/${row.id}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          Miembros
        </Link>
      )}
      list={() => unwrap(api.v1.groups.$get())}
      create={(json) => unwrap(api.v1.groups.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.groups[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
