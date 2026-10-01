'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { ErrorConReintento } from '@/components/error-con-reintento'
import { Paginador } from '@/components/paginador'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer } from '@/lib/api'
import { useAreas, useCargos } from '@/lib/catalogos'
import { paginaCorregida } from '@/lib/paginas'
import { cn } from '@/lib/utils'
import { useValorRetrasado } from '@/lib/valor-retrasado'
import { useYo } from '@/lib/yo'

const FILTROS_INICIALES = { search: '', areaId: '', employmentType: '', status: 'active' }

export default function PaginaTrabajadores() {
  const { data: yo } = useYo()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  // El input muestra lo que se escribe al instante; la consulta usa el texto retrasado.
  const textoRetrasado = useValorRetrasado(filtros.search)
  const filtrosConsulta = { ...filtros, search: textoRetrasado }

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['trabajadores', filtrosConsulta, pagina],
    placeholderData: keepPreviousData,
    queryFn: () =>
      leer(
        api.v1.workers.$get({
          query: {
            page: String(pagina.pagina),
            pageSize: String(pagina.tamano),
            // Solo se mandan los filtros con valor.
            ...Object.fromEntries(Object.entries(filtrosConsulta).filter(([, v]) => v.trim() !== '')),
          },
        }),
      ),
  })

  // Si la página quedó más allá del final (por ejemplo, porque hay menos trabajadores que antes), se va a la última.
  const corregida = data && !isPlaceholderData ? paginaCorregida(pagina.pagina, pagina.tamano, data.total, data.items.length) : null
  if (corregida !== null) setPagina((p) => ({ ...p, pagina: corregida }))

  function filtrar(campo: keyof typeof FILTROS_INICIALES, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina((p) => ({ ...p, pagina: 1 }))
  }

  const puedeCrear = yo?.role === 'admin' || yo?.role === 'accounting'
  const nombreDe = (lista: { id: string; name: string }[] | undefined, id: string | null) =>
    lista?.find((x) => x.id === id)?.name ?? '–'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trabajadores</h1>
        {puedeCrear && (
          <Link href="/trabajadores/nuevo" className={buttonVariants({ size: 'lg' })}>
            Nuevo trabajador
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem]">
        <Input
          aria-label="Buscar por nombre o DNI"
          placeholder="Buscar por nombre o DNI"
          className="h-9"
          value={filtros.search}
          onChange={(e) => filtrar('search', e.target.value)}
        />
        <select aria-label="Área" className={claseControl} value={filtros.areaId} onChange={(e) => filtrar('areaId', e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas?.items.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select aria-label="Modalidad" className={claseControl} value={filtros.employmentType} onChange={(e) => filtrar('employmentType', e.target.value)}>
          <option value="">Toda modalidad</option>
          <option value="temporary">Temporal</option>
          <option value="contract">Contrato</option>
        </select>
        <select aria-label="Estado" className={claseControl} value={filtros.status} onChange={(e) => filtrar('status', e.target.value)}>
          <option value="active">Activos</option>
          <option value="terminated">Cesados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Mientras llega la página nueva se sigue viendo la anterior, atenuada. */}
      <div
        aria-busy={isPlaceholderData}
        className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Estado</TableHead>
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
                  Ningún trabajador coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/trabajadores/${t.id}`} className="font-medium text-primary">
                    {t.lastName}, {t.firstName}
                  </Link>
                  <span className={`block text-xs ${t.dni ? 'text-muted-foreground' : 'font-semibold text-amber-800'}`}>
                    {t.dni ? `DNI ${t.dni}` : 'DNI pendiente'}
                  </span>
                </TableCell>
                <TableCell>{nombreDe(areas?.items, t.areaId)}</TableCell>
                <TableCell>{nombreDe(cargos?.items, t.positionId)}</TableCell>
                <TableCell>{t.employmentType === 'contract' ? 'Contrato' : 'Temporal'}</TableCell>
                <TableCell>
                  <Badge variant={t.status === 'active' ? 'secondary' : 'outline'}>{t.status === 'active' ? 'Activo' : 'Cesado'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && <Paginador pagina={pagina.pagina} tamano={pagina.tamano} total={data.total} alCambiar={setPagina} />}
    </div>
  )
}
