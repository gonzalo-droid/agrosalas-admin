'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { useAreas } from '@/lib/catalogos'
import { ETIQUETA_ROL } from '@/lib/yo'

// De menos a más privilegiado: el primero es el que queda preseleccionado al crear un usuario.
const ROLES = (['coordinator', 'accounting', 'management', 'admin'] as const).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_ROL[valor],
}))

export default function PaginaUsuarios() {
  const { data: areas } = useAreas()
  const nombreArea = (id: string) => areas?.items.find((a) => a.id === id)?.name ?? '…'

  return (
    <Catalogo
      titulo="Usuarios y roles"
      descripcion="Las cuentas solo se crean aquí. El coordinador ve únicamente las áreas que se le asignen."
      textoNuevo="Nuevo usuario"
      claveConsulta="usuarios"
      puedeEditar
      columnas={[
        { titulo: 'Nombre', celda: (f) => String(f.name) },
        { titulo: 'Correo', celda: (f) => String(f.email) },
        { titulo: 'Rol', celda: (f) => ETIQUETA_ROL[f.role as keyof typeof ETIQUETA_ROL] },
        { titulo: 'Áreas', celda: (f) => (f.areaIds as string[]).map(nombreArea).join(', ') || (f.role === 'coordinator' ? 'Ninguna' : 'Todas') },
      ]}
      campos={[
        { nombre: 'email', etiqueta: 'Correo', tipo: 'correo', obligatorio: true, soloAlCrear: true },
        { nombre: 'password', etiqueta: 'Contraseña inicial', tipo: 'clave', obligatorio: true, soloAlCrear: true, ayuda: 'Mínimo 8 caracteres. La persona puede cambiarla en su perfil.' },
        { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'role', etiqueta: 'Rol', tipo: 'opcion', opciones: ROLES },
        {
          nombre: 'areaIds',
          etiqueta: 'Áreas (solo para coordinador)',
          tipo: 'opciones',
          // Las áreas inactivas solo aparecen (marcadas) en el usuario que ya las tiene, para poder quitárselas.
          opciones: (areas?.items ?? []).map((a) => ({ valor: a.id, etiqueta: a.name, inactiva: !a.active })),
        },
      ]}
      listar={() => leer(api.v1.users.$get())}
      crear={(json) => leer(api.v1.users.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.users[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
