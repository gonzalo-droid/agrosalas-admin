'use client'

import { Catalog } from '@/components/catalog'
import { api, unwrap } from '@/lib/api'
import { useAreas } from '@/lib/catalogs'
import { ROLE_LABEL } from '@/lib/me'

// From least to most privileged: the first one is preselected when creating a user.
const ROLES = (['coordinator', 'accounting', 'management', 'admin'] as const).map((value) => ({
  value,
  label: ROLE_LABEL[value],
}))

export default function UsersPage() {
  const { data: areas } = useAreas()
  const areaName = (id: string) => areas?.items.find((a) => a.id === id)?.name ?? '…'

  return (
    <Catalog
      title="Usuarios y roles"
      description="Las cuentas solo se crean aquí. El coordinador ve únicamente las áreas que se le asignen."
      newLabel="Nuevo usuario"
      queryKey="users"
      canEdit
      columns={[
        { title: 'Nombre', cell: (row) => String(row.name) },
        { title: 'Correo', cell: (row) => String(row.email) },
        { title: 'Rol', cell: (row) => ROLE_LABEL[row.role as keyof typeof ROLE_LABEL] },
        { title: 'Áreas', cell: (row) => (row.areaIds as string[]).map(areaName).join(', ') || (row.role === 'coordinator' ? 'Ninguna' : 'Todas') },
      ]}
      fields={[
        { name: 'email', label: 'Correo', type: 'email', required: true, createOnly: true },
        { name: 'password', label: 'Contraseña inicial', type: 'password', required: true, createOnly: true, help: 'Mínimo 8 caracteres. La persona puede cambiarla en su perfil.' },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'role', label: 'Rol', type: 'select', options: ROLES },
        {
          name: 'areaIds',
          label: 'Áreas (solo para coordinador)',
          type: 'multiselect',
          // Inactive areas only appear (marked) on the user that already has them, so they can be removed.
          options: (areas?.items ?? []).map((a) => ({ value: a.id, label: a.name, inactive: !a.active })),
        },
      ]}
      list={() => unwrap(api.v1.users.$get())}
      create={(json) => unwrap(api.v1.users.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.users[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
