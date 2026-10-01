'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

export default function PaginaAreas() {
  return (
    <Catalogo
      titulo="Áreas"
      descripcion="Sirven para organizar a los trabajadores y para limitar lo que ve cada coordinador."
      textoNuevo="Nueva área"
      claveConsulta="areas"
      puedeEditar
      columnas={[{ titulo: 'Área', celda: (f) => String(f.name) }]}
      campos={[{ nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }]}
      listar={() => leer(api.v1.areas.$get())}
      crear={(json) => leer(api.v1.areas.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.areas[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
