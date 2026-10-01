'use client'

import Link from 'next/link'
import { Catalogo } from '@/components/catalogo'
import { buttonVariants } from '@/components/ui/button'
import { api, leer } from '@/lib/api'
import { rangoFechas } from '@/lib/formato'

export default function PaginaGrupos() {
  return (
    <Catalogo
      titulo="Grupos de trabajadores"
      descripcion="Un grupo sirve para cargar varios trabajadores a una planilla de una sola vez. Un trabajador puede estar en varios."
      textoNuevo="Nuevo grupo"
      claveConsulta="grupos"
      puedeEditar
      columnas={[
        { titulo: 'Grupo', celda: (f) => String(f.nombre) },
        {
          titulo: 'Tipo',
          celda: (f) => {
            if (!f.temporal) return 'Fijo'
            const rango = rangoFechas(f.fechaInicio as string | null, f.fechaFin as string | null)
            return rango ? `Temporal · ${rango}` : 'Temporal'
          },
        },
        { titulo: 'Miembros', derecha: true, celda: (f) => String(f.miembros) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'temporal', etiqueta: 'Es temporal (armado por unos días)', tipo: 'casilla' },
        { nombre: 'fechaInicio', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'fechaFin', etiqueta: 'Hasta', tipo: 'fecha' },
      ]}
      accionesFila={(f) => (
        <Link href={`/configuracion/grupos/${f.id}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          Miembros
        </Link>
      )}
      listar={() => leer(api.v1.grupos.$get())}
      crear={(json) => leer(api.v1.grupos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.grupos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
