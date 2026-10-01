'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { Paginador } from '@/components/paginador'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer } from '@/lib/api'

const ENTIDADES = ['trabajadores', 'trabajador_metodos_pago', 'usuarios', 'cargos', 'grupos', 'areas', 'turnos', 'campanas']
const ACCION = { crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó' } as const
const fechaHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

export default function PaginaAuditoria() {
  const [entidad, setEntidad] = useState('')
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  const { data, isPending } = useQuery({
    queryKey: ['auditoria', entidad, pagina],
    queryFn: () =>
      leer(
        api.v1.auditoria.$get({
          query: { pagina: String(pagina.pagina), tamano: String(pagina.tamano), ...(entidad ? { entidad } : {}) },
        }),
      ),
  })

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
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-background">
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
            {data?.datos.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap">{fechaHora.format(new Date(f.creadoEn))}</TableCell>
                <TableCell>{f.usuarioNombre}</TableCell>
                <TableCell>{ACCION[f.accion]}</TableCell>
                <TableCell>{f.entidad}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={JSON.stringify(f.despues ?? f.antes)}>
                  {JSON.stringify(f.despues ?? f.antes)}
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
