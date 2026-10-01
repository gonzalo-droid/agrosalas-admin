'use client'

import { Catalog } from '@/components/catalog'
import { api, unwrap } from '@/lib/api'

export default function AreasPage() {
  return (
    <Catalog
      title="Áreas"
      description="Sirven para organizar a los trabajadores y para limitar lo que ve cada coordinador."
      newLabel="Nueva área"
      queryKey="areas"
      canEdit
      columns={[{ title: 'Área', cell: (row) => String(row.name) }]}
      fields={[{ name: 'name', label: 'Nombre', type: 'text', required: true }]}
      list={() => unwrap(api.v1.areas.$get())}
      create={(json) => unwrap(api.v1.areas.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.areas[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
