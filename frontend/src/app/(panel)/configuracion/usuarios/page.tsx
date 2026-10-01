'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { useAreas } from '@/lib/catalogos'
import { ETIQUETA_ROL } from '@/lib/yo'

// De menos a más privilegiado: el primero es el que queda preseleccionado al crear un usuario.
const ROLES = (['coordinador', 'contabilidad', 'gerencia', 'admin'] as const).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_ROL[valor],
}))

export default function PaginaUsuarios() {
  const { data: areas } = useAreas()
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
        { titulo: 'Áreas', celda: (f) => (f.areaIds as string[]).map(nombreArea).join(', ') || (f.rol === 'coordinador' ? 'Ninguna' : 'Todas') },
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
          // Las áreas inactivas solo aparecen (marcadas) en el usuario que ya las tiene, para poder quitárselas.
          opciones: (areas?.datos ?? []).map((a) => ({ valor: a.id, etiqueta: a.nombre, inactiva: !a.activo })),
        },
      ]}
      listar={() => leer(api.v1.usuarios.$get())}
      crear={(json) => leer(api.v1.usuarios.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.usuarios[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
