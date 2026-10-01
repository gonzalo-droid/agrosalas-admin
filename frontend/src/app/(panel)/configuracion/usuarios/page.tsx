'use client'

import { useQuery } from '@tanstack/react-query'
import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { ETIQUETA_ROL } from '@/lib/yo'

const ROLES = (Object.keys(ETIQUETA_ROL) as (keyof typeof ETIQUETA_ROL)[]).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_ROL[valor],
}))

export default function PaginaUsuarios() {
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: () => leer(api.v1.areas.$get()) })
  const nombreArea = (id: string) => areas?.datos.find((a) => a.id === id)?.nombre ?? '…'

  return (
    <Catalogo
      titulo="Usuarios y roles"
      descripcion="Las cuentas solo se crean aquí. El coordinador ve únicamente las áreas que se le asignen."
      textoNuevo="Nuevo usuario"
      claveConsulta="usuarios"
      puedeEditar
      columnas={[
        { titulo: 'Nombre', celda: (f) => String(f.nombre) },
        { titulo: 'Correo', celda: (f) => String(f.correo) },
        { titulo: 'Rol', celda: (f) => ETIQUETA_ROL[f.rol as keyof typeof ETIQUETA_ROL] },
        { titulo: 'Áreas', celda: (f) => (f.areaIds as string[]).map(nombreArea).join(', ') || 'Todas' },
      ]}
      campos={[
        { nombre: 'correo', etiqueta: 'Correo', tipo: 'correo', obligatorio: true, soloAlCrear: true },
        { nombre: 'clave', etiqueta: 'Contraseña inicial', tipo: 'clave', obligatorio: true, soloAlCrear: true, ayuda: 'Mínimo 8 caracteres. La persona puede cambiarla en su perfil.' },
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'rol', etiqueta: 'Rol', tipo: 'opcion', opciones: ROLES },
        {
          nombre: 'areaIds',
          etiqueta: 'Áreas (solo para coordinador)',
          tipo: 'opciones',
          opciones: (areas?.datos ?? []).filter((a) => a.activo).map((a) => ({ valor: a.id, etiqueta: a.nombre })),
        },
      ]}
      listar={() => leer(api.v1.usuarios.$get())}
      crear={(json) => leer(api.v1.usuarios.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.usuarios[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
