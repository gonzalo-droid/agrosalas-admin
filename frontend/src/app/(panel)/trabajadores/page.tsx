'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { Paginador } from '@/components/paginador'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useAreas, useCargos } from '@/lib/catalogos'
import { useValorRetrasado } from '@/lib/valor-retrasado'
import { useYo } from '@/lib/yo'

const FILTROS_INICIALES = { texto: '', areaId: '', modalidad: '', estado: 'activo' }

export default function PaginaTrabajadores() {
  const { data: yo } = useYo()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  // El input muestra lo que se escribe al instante; la consulta usa el texto retrasado.
  const textoRetrasado = useValorRetrasado(filtros.texto)
  const filtrosConsulta = { ...filtros, texto: textoRetrasado }

  const { data, isPending, error } = useQuery({
    queryKey: ['trabajadores', filtrosConsulta, pagina],
    placeholderData: keepPreviousData,
    queryFn: () =>
      leer(
        api.v1.trabajadores.$get({
          query: {
            pagina: String(pagina.pagina),
            tamano: String(pagina.tamano),
            // Solo se mandan los filtros con valor.
            ...Object.fromEntries(Object.entries(filtrosConsulta).filter(([, v]) => v.trim() !== '')),
          },
        }),
      ),
  })

  function filtrar(campo: keyof typeof FILTROS_INICIALES, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina((p) => ({ ...p, pagina: 1 }))
  }

  const puedeCrear = yo?.rol === 'admin' || yo?.rol === 'contabilidad'
  const nombreDe = (lista: { id: string; nombre: string }[] | undefined, id: string | null) =>
    lista?.find((x) => x.id === id)?.nombre ?? '–'

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
          value={filtros.texto}
          onChange={(e) => filtrar('texto', e.target.value)}
        />
        <select aria-label="Área" className={claseControl} value={filtros.areaId} onChange={(e) => filtrar('areaId', e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas?.datos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select aria-label="Modalidad" className={claseControl} value={filtros.modalidad} onChange={(e) => filtrar('modalidad', e.target.value)}>
          <option value="">Toda modalidad</option>
          <option value="temporal">Temporal</option>
          <option value="contrato">Contrato</option>
        </select>
        <select aria-label="Estado" className={claseControl} value={filtros.estado} onChange={(e) => filtrar('estado', e.target.value)}>
          <option value="activo">Activos</option>
          <option value="cesado">Cesados</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
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
                <TableCell colSpan={5} className="text-destructive">
                  {mensajeDeError(error)}
                </TableCell>
              </TableRow>
            )}
            {data?.datos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Ningún trabajador coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.datos.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/trabajadores/${t.id}`} className="font-medium text-primary">
                    {t.apellidos}, {t.nombres}
                  </Link>
                  <span className={`block text-xs ${t.dni ? 'text-muted-foreground' : 'font-semibold text-amber-800'}`}>
                    {t.dni ? `DNI ${t.dni}` : 'DNI pendiente'}
                  </span>
                </TableCell>
                <TableCell>{nombreDe(areas?.datos, t.areaId)}</TableCell>
                <TableCell>{nombreDe(cargos?.datos, t.cargoId)}</TableCell>
                <TableCell>{t.modalidad === 'contrato' ? 'Contrato' : 'Temporal'}</TableCell>
                <TableCell>
                  <Badge variant={t.estado === 'activo' ? 'secondary' : 'outline'}>{t.estado === 'activo' ? 'Activo' : 'Cesado'}</Badge>
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
