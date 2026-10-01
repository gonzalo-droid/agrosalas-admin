'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { ErrorConReintento } from '@/components/error-con-reintento'
import { Paginador } from '@/components/paginador'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer } from '@/lib/api'
import { ETIQUETA_ENTIDAD, resumenCambio } from '@/lib/auditoria'
import { paginaCorregida } from '@/lib/paginas'
import { cn } from '@/lib/utils'

const ENTIDADES = Object.keys(ETIQUETA_ENTIDAD)
const etiquetaEntidad = (entidad: string) => ETIQUETA_ENTIDAD[entidad] ?? entidad
const ACCION = { create: 'Creó', update: 'Editó', delete: 'Eliminó' } as const
const fechaHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

export default function PaginaAuditoria() {
  const [entidad, setEntidad] = useState('')
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['auditoria', entidad, pagina],
    placeholderData: keepPreviousData,
    queryFn: () =>
      leer(
        api.v1['audit-log'].$get({
          query: { page: String(pagina.pagina), pageSize: String(pagina.tamano), ...(entidad ? { entity: entidad } : {}) },
        }),
      ),
  })

  // Si la página quedó más allá del final, se va a la última que existe.
  const corregida = data && !isPlaceholderData ? paginaCorregida(pagina.pagina, pagina.tamano, data.total, data.items.length) : null
  if (corregida !== null) setPagina((p) => ({ ...p, pagina: corregida }))

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">Auditoría</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="filtro-entidad" className="text-muted-foreground">
            Tabla
          </label>
          <select
            id="filtro-entidad"
            className={`${claseControl} w-56`}
            value={entidad}
            onChange={(e) => {
              setEntidad(e.target.value)
              setPagina((p) => ({ ...p, pagina: 1 }))
            }}
          >
            <option value="">Todas</option>
            {ENTIDADES.map((e) => (
              <option key={e} value={e}>
                {etiquetaEntidad(e)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Mientras llega la página nueva se sigue viendo la anterior, atenuada. */}
      <div
        aria-busy={isPlaceholderData}
        className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5}>
                  <ErrorConReintento error={error} alReintentar={refetch} />
                </TableCell>
              </TableRow>
            )}
            {data?.total === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No hay cambios registrados.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap">{fechaHora.format(new Date(f.createdAt))}</TableCell>
                <TableCell>{f.userName}</TableCell>
                <TableCell>{ACCION[f.action]}</TableCell>
                <TableCell>{etiquetaEntidad(f.entity)}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={resumenCambio(f.action, f.before, f.after)}>
                  {resumenCambio(f.action, f.before, f.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginador pagina={pagina.pagina} tamano={pagina.tamano} total={data?.total ?? 0} alCambiar={setPagina} />
    </section>
  )
}
